import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLiveStreamOrDemo } from "@/lib/mux";
import { notifyCourseStudents } from "@/lib/notify";
import { getTeacherForUser } from "@/lib/teacher";
import { canTeacherStartLive, isWaitingLessonStatus, startLiveSession } from "@/lib/live-session";
import {
  isCourseReviewV1Enabled,
  isLiveWaitingRoomV2Enabled,
  isScheduleRulesV1Enabled,
} from "@/lib/feature-flags";
import { checkTeacherCanOpenNow } from "@/lib/schedule-guard";
import { isLiveAllowedForCourse, lifecycleLabel } from "@/lib/course-review-policy";
import { writeAuditLog } from "@/lib/audit-log";

/** Haqiqiy jonli efir — yozuv shu paytdan. Kutishdan yoki to‘g‘ridan. */
export async function POST(
  _req: Request,
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
    return NextResponse.json({ error: "Bekor qilingan darsni boshlab bo‘lmaydi" }, { status: 400 });
  }
  if (lesson.status === "ended") {
    return NextResponse.json({ error: "Tugagan darsni qayta boshlab bo‘lmaydi" }, { status: 400 });
  }
  if (isCourseReviewV1Enabled() && !isLiveAllowedForCourse(lesson.course.lifecycleStatus)) {
    return NextResponse.json(
      {
        error: `Kurs «${lifecycleLabel(lesson.course.lifecycleStatus)}» holatida — efir faqat nashr etilgan kursda`,
      },
      { status: 409 },
    );
  }

  if (lesson.status === "live") {
    const demo = Boolean(lesson.streamKey?.startsWith("demo_"));
    let liveSession = null;
    if (isLiveWaitingRoomV2Enabled()) {
      liveSession = await startLiveSession(lesson.id);
    }
    return NextResponse.json({
      lesson,
      demo,
      rtmpUrl: demo ? null : "rtmps://global-live.mux.com:443/app",
      liveSession,
    });
  }

  if (
    lesson.status !== "scheduled" &&
    !isWaitingLessonStatus(lesson.status)
  ) {
    return NextResponse.json({ error: "Efirni shu holatdan boshlab bo‘lmaydi" }, { status: 400 });
  }
  if (!canTeacherStartLive(lesson.status)) {
    return NextResponse.json({ error: "Efirni shu holatdan boshlab bo‘lmaydi" }, { status: 400 });
  }
  if (isScheduleRulesV1Enabled()) {
    const check = await checkTeacherCanOpenNow(teacher.id, lesson);
    if (!check.ok) {
      return NextResponse.json({ error: check.message, code: check.code }, { status: 409 });
    }
  }

  // Claim the transition first so a double click / second tab cannot create a second
  // stream, resurrect a lesson that was just ended, or notify students twice.
  const claimed = await prisma.lesson.updateMany({
    where: { id: lesson.id, status: lesson.status },
    data: { status: "live" },
  });
  if (claimed.count !== 1) {
    const current = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });
    if (current.status !== "live") {
      return NextResponse.json(
        { error: "Dars holati hozirgina o‘zgardi — sahifani yangilang" },
        { status: 409 },
      );
    }
    const demo = Boolean(current.streamKey?.startsWith("demo_"));
    return NextResponse.json({
      lesson: current,
      demo,
      rtmpUrl: demo ? null : "rtmps://global-live.mux.com:443/app",
      liveSession: isLiveWaitingRoomV2Enabled() ? await startLiveSession(lesson.id) : null,
    });
  }

  let stream: Awaited<ReturnType<typeof createLiveStreamOrDemo>>;
  if (lesson.muxLiveStreamId && lesson.muxLivePlaybackId && lesson.streamKey) {
    stream = {
      liveStreamId: lesson.muxLiveStreamId,
      livePlaybackId: lesson.muxLivePlaybackId,
      streamKey: lesson.streamKey,
      demo: lesson.streamKey.startsWith("demo_"),
    };
  } else {
    try {
      stream = await createLiveStreamOrDemo(lesson.titleUz);
    } catch (err) {
      await prisma.lesson.updateMany({
        where: { id: lesson.id, status: "live" },
        data: { status: lesson.status },
      });
      throw err;
    }
  }
  const updated = await prisma.lesson.update({
    where: { id: lesson.id },
    data: {
      muxLiveStreamId: stream.liveStreamId,
      muxLivePlaybackId: stream.livePlaybackId,
      streamKey: stream.streamKey,
    },
  });

  let liveSession = null;
  if (isLiveWaitingRoomV2Enabled()) {
    liveSession = await startLiveSession(lesson.id);
  }

  if (
    isCourseReviewV1Enabled() &&
    (lesson.course.lifecycleStatus === "published" ||
      lesson.course.lifecycleStatus === "upcoming" ||
      (lesson.course.lifecycleStatus === null && lesson.course.isPublished))
  ) {
    await prisma.course.updateMany({
      where: { id: lesson.courseId, lifecycleStatus: lesson.course.lifecycleStatus },
      data: { lifecycleStatus: "active" },
    });
    await writeAuditLog({
      actorId: session.user.id,
      action: "course.activated",
      entityType: "Course",
      entityId: lesson.courseId,
      metadata: { from: lesson.course.lifecycleStatus, to: "active", lessonId: lesson.id },
    });
  }

  await notifyCourseStudents(
    lesson.courseId,
    {
      type: "lesson_live",
      titleUz: "Jonli efir boshlandi!",
      messageUz: `${lesson.course.titleUz}: ${lesson.titleUz}`,
      relatedId: lesson.id,
    },
    "t2",
  );

  return NextResponse.json({
    lesson: updated,
    demo: stream.demo,
    rtmpUrl: stream.demo ? null : "rtmps://global-live.mux.com:443/app",
    liveSession,
  });
}
