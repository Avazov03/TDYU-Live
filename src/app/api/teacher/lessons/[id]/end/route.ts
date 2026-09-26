import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { completeMuxLiveStream } from "@/lib/mux-client";
import { closeLiveRoom } from "@/lib/live-rooms";
import { notifyCourseStudents } from "@/lib/notify";
import { getTeacherForUser } from "@/lib/teacher";
import { canTeacherEndLive, endLiveSession, isWaitingLessonStatus } from "@/lib/live-session";
import { formatDateTime } from "@/lib/utils";
import {
  isLiveAttendanceV3Enabled,
  isLiveWaitingRoomV2Enabled,
  isRecordingReviewV1Enabled,
} from "@/lib/feature-flags";
import { closeAllOpenAttendanceForLiveSession } from "@/lib/live-attendance";
import { startRecordingAfterLiveEnd } from "@/lib/recording-lifecycle";
import { isStorageKeyForLesson } from "@/lib/recording-storage";

const bodySchema = z
  .object({
    recordingUrl: z.string().trim().min(1).max(400).optional(),
  })
  .optional();

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }
  const teacher = await getTeacherForUser(session.user.id);
  if (!teacher) return NextResponse.json({ error: "Profil yo'q" }, { status: 404 });

  const { id } = await params;
  const lesson = await prisma.lesson.findFirst({
    where: { id, course: { teacherId: teacher.id } },
    include: { course: true },
  });
  if (!lesson) return NextResponse.json({ error: "Dars topilmadi" }, { status: 404 });

  if (lesson.status === "cancelled") {
    return NextResponse.json({ error: "Bekor qilingan dars" }, { status: 400 });
  }
  if (
    lesson.status === "ended" ||
    lesson.status === "recording_processing" ||
    lesson.status === "recording_ready" ||
    lesson.status === "teacher_review" ||
    lesson.status === "published"
  ) {
    return NextResponse.json({ lesson });
  }
  if (!canTeacherEndLive(lesson.status) && lesson.status !== "scheduled") {
    return NextResponse.json({ error: "Bu darsni yopib bo‘lmaydi" }, { status: 400 });
  }

  if (isWaitingLessonStatus(lesson.status)) {
    // Never aired: no recording, no attendance — the lesson can be reopened later.
    closeLiveRoom(lesson.id);
    const liveSession = isLiveWaitingRoomV2Enabled() ? await endLiveSession(lesson.id) : null;
    await prisma.lesson.updateMany({
      where: { id: lesson.id, status: lesson.status },
      data: { status: "scheduled" },
    });
    const updated = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });
    await notifyCourseStudents(lesson.courseId, {
      type: "system",
      titleUz: "Kutish xonasi yopildi",
      messageUz: `${lesson.course.titleUz}: ${lesson.titleUz} — efir hali boshlanmagan. Dars rejadagi vaqtda (${formatDateTime(lesson.scheduledAt)}) bo‘ladi.`,
      relatedId: lesson.id,
    }).catch(() => undefined);
    return NextResponse.json({ lesson: updated, liveSession, waitingClosed: true });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  const clientRecordingUrl = parsed.success ? parsed.data?.recordingUrl : undefined;
  const recordingUrl =
    clientRecordingUrl && isStorageKeyForLesson(clientRecordingUrl, lesson) ? clientRecordingUrl : undefined;

  if (lesson.muxLiveStreamId) {
    const completed = await completeMuxLiveStream(lesson.muxLiveStreamId);
    if (!completed.ok) {
      console.warn(
        JSON.stringify({
          event: "live_mux.complete_failed",
          reason: completed.reason,
          status: completed.status ?? null,
          lessonId: lesson.id,
          streamRef: lesson.muxLiveStreamId.slice(0, 6),
          at: new Date().toISOString(),
        }),
      );
    }
  }
  closeLiveRoom(lesson.id);

  const vodMux = lesson.muxVodPlaybackId;
  const savedUrl = recordingUrl || lesson.recordingUrl || null;
  const awaitingMuxVod = Boolean(
    lesson.muxLiveStreamId && !lesson.muxLiveStreamId.startsWith("demo_"),
  );

  let liveSession = null;
  if (isLiveWaitingRoomV2Enabled()) {
    liveSession = await endLiveSession(lesson.id);
    if (isLiveAttendanceV3Enabled() && liveSession?.id) {
      await closeAllOpenAttendanceForLiveSession(liveSession.id);
    }
  }

  if (isRecordingReviewV1Enabled()) {
    const result = await startRecordingAfterLiveEnd({
      lessonId: lesson.id,
      liveSessionId: liveSession?.id ?? null,
      recordingUrl: savedUrl,
      muxVodPlaybackId: vodMux,
      awaitingMuxVod,
    });

    const updated = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });

    await notifyCourseStudents(lesson.courseId, {
      type: "lesson_live",
      titleUz: "Dars tugadi",
      messageUz: `${lesson.course.titleUz}: ${lesson.titleUz} yakunlandi.${
        result.recording ? " Yozuv o‘qituvchi tekshiruvidan keyin ochiladi." : ""
      }`,
      relatedId: lesson.id,
    });

    return NextResponse.json({
      lesson: updated,
      liveSession,
      recording: result.recording,
    });
  }

  const hasRealVod =
    Boolean(savedUrl) || Boolean(vodMux && !vodMux.startsWith("demo_"));

  const updated = await prisma.lesson.update({
    where: { id: lesson.id },
    data: {
      status: "ended",
      recordingUrl: savedUrl,
      // Never copy the live-stream playback id into the VOD column: it is not a recording.
      muxVodPlaybackId: vodMux,
    },
  });

  await notifyCourseStudents(lesson.courseId, {
    type: "lesson_live",
    titleUz: hasRealVod ? "Yozuv tayyor" : "Dars tugadi",
    messageUz: hasRealVod
      ? `${lesson.course.titleUz}: ${lesson.titleUz} yozuvi ochildi.`
      : `${lesson.course.titleUz}: ${lesson.titleUz} yakunlandi.`,
    relatedId: lesson.id,
  });

  return NextResponse.json({ lesson: updated, liveSession });
}
