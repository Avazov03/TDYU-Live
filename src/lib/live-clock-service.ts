import { prisma } from "@/lib/prisma";
import { closeLiveRoom } from "@/lib/live-rooms";
import { closeAllOpenAttendanceForLiveSession } from "@/lib/live-attendance";
import { endLiveSession } from "@/lib/live-session";
import {
  advanceTeachingClock,
  setManualPause,
  type TeachingClockInput,
} from "@/lib/live-teaching-clock";
import { isLiveAttendanceV3Enabled, isRecordingReviewV1Enabled } from "@/lib/feature-flags";
import { startRecordingAfterLiveEnd } from "@/lib/recording-lifecycle";
import { notifyCourseStudents } from "@/lib/notify";
import { completeMuxLiveStream } from "@/lib/mux-client";

function toInput(
  session: {
    status: TeachingClockInput["status"];
    activeTeachingSeconds: number;
    pauseSeconds: number;
    lastTeacherBeatAt: Date | null;
    manualPause: boolean;
    warn55Sent: boolean;
    warn58Sent: boolean;
    warn59Sent: boolean;
  },
  now: Date,
  actor: TeachingClockInput["actor"],
): TeachingClockInput {
  return { ...session, now, actor };
}

async function persistClock(
  sessionId: string,
  result: ReturnType<typeof advanceTeachingClock>,
) {
  await prisma.liveSession.update({
    where: { id: sessionId },
    data: {
      status: result.status === "ended" ? "ended" : result.status,
      activeTeachingSeconds: result.activeTeachingSeconds,
      pauseSeconds: result.pauseSeconds,
      lastTeacherBeatAt: result.lastTeacherBeatAt,
      manualPause: result.manualPause,
      warn55Sent: result.warn55Sent,
      warn58Sent: result.warn58Sent,
      warn59Sent: result.warn59Sent,
      ...(result.autoEnd ? { endedAt: new Date() } : {}),
    },
  });
}

export async function autoEndLesson(
  lessonId: string,
  liveSessionId: string,
  notice?: { titleUz: string; messageUz: string },
): Promise<boolean> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { course: { select: { id: true, titleUz: true } } },
  });
  if (!lesson) return false;
  if (lesson.status !== "live" && lesson.status !== "paused") return false;
  const claimed = await prisma.lesson.updateMany({
    where: { id: lesson.id, status: { in: ["live", "paused"] } },
    data: { status: "ended" },
  });
  if (claimed.count !== 1) return false;
  if (lesson.muxLiveStreamId) {
    await completeMuxLiveStream(lesson.muxLiveStreamId).catch(() => undefined);
  }
  closeLiveRoom(lesson.id);
  await endLiveSession(lesson.id);
  if (isRecordingReviewV1Enabled()) {
    await startRecordingAfterLiveEnd({
      lessonId: lesson.id,
      liveSessionId,
      recordingUrl: lesson.recordingUrl,
      muxVodPlaybackId: lesson.muxVodPlaybackId,
      awaitingMuxVod: Boolean(lesson.muxLiveStreamId && !lesson.muxLiveStreamId.startsWith("demo_")),
    }).catch(() => undefined);
  }
  await notifyCourseStudents(lesson.courseId, {
    type: "lesson_live",
    titleUz: notice?.titleUz ?? "Dars 60 daqiqada yopildi",
    messageUz: notice?.messageUz ?? `${lesson.course.titleUz}: ${lesson.titleUz} dars vaqti tugadi.`,
    relatedId: lesson.id,
  }).catch(() => undefined);
  return true;
}

export async function beatTeachingClock(input: {
  lessonId: string;
  actor: "teacher" | "observer";
  manualPause?: boolean;
}) {
  const session = await prisma.liveSession.findFirst({
    where: { lessonId: input.lessonId, status: { in: ["live", "paused"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!session) return null;
  const now = new Date();
  const clockInput = toInput(session, now, input.actor);
  const result =
    input.manualPause === undefined
      ? advanceTeachingClock(clockInput)
      : setManualPause(clockInput, input.manualPause);
  await persistClock(session.id, result);
  if (result.status === "paused" || result.status === "live") {
    const lessonStatus = result.manualPause || result.status === "paused" ? "paused" : "live";
    await prisma.lesson.updateMany({
      where: { id: input.lessonId, status: { in: ["live", "paused"] } },
      data: { status: lessonStatus },
    });
  }
  if (result.autoEnd) {
    if (isLiveAttendanceV3Enabled()) {
      await closeAllOpenAttendanceForLiveSession(session.id);
    }
    await autoEndLesson(input.lessonId, session.id);
  }
  return result;
}
