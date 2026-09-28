import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyCourseStudents } from "@/lib/notify";
import { getTeacherForUser } from "@/lib/teacher";
import {
  canTeacherOpenWaiting,
  ensureWaitingLiveSession,
  isWaitingLessonStatus,
} from "@/lib/live-session";
import {
  isCourseReviewV1Enabled,
  isLiveWaitingRoomV2Enabled,
  isScheduleRulesV1Enabled,
} from "@/lib/feature-flags";
import { checkTeacherCanOpenNow } from "@/lib/schedule-guard";
import { isLiveAllowedForCourse, lifecycleLabel } from "@/lib/course-review-policy";

/** Kutish xonasini ochadi — yozuv/Mux hali yo‘q. LiveSession WAITING (Wave 1). */
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
    return NextResponse.json({ error: "Bekor qilingan darsni ochib bo‘lmaydi" }, { status: 400 });
  }
  if (lesson.status === "ended") {
    return NextResponse.json({ error: "Tugagan darsni qayta ochib bo‘lmaydi" }, { status: 400 });
  }
  if (isCourseReviewV1Enabled() && !isLiveAllowedForCourse(lesson.course.lifecycleStatus)) {
    return NextResponse.json(
      {
        error: `Kurs «${lifecycleLabel(lesson.course.lifecycleStatus)}» holatida — efir faqat nashr etilgan kursda`,
      },
      { status: 409 },
    );
  }

  if (isWaitingLessonStatus(lesson.status) || lesson.status === "live") {
    let liveSession = null;
    if (isLiveWaitingRoomV2Enabled()) {
      liveSession = await ensureWaitingLiveSession(lesson.id);
    }
    return NextResponse.json({ lesson, liveSession });
  }

  if (!canTeacherOpenWaiting(lesson.status) || lesson.status !== "scheduled") {
    return NextResponse.json({ error: "Bu dars kutishga ochilmaydi" }, { status: 400 });
  }
  if (isScheduleRulesV1Enabled()) {
    const check = await checkTeacherCanOpenNow(teacher.id, lesson);
    if (!check.ok) {
      return NextResponse.json({ error: check.message, code: check.code }, { status: 409 });
    }
  }

  const claimed = await prisma.lesson.updateMany({
    where: { id: lesson.id, status: "scheduled" },
    data: { status: "lobby" },
  });
  if (claimed.count !== 1) {
    const current = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });
    if (!isWaitingLessonStatus(current.status) && current.status !== "live") {
      return NextResponse.json(
        { error: "Dars holati hozirgina o‘zgardi — sahifani yangilang" },
        { status: 409 },
      );
    }
    return NextResponse.json({
      lesson: current,
      liveSession: isLiveWaitingRoomV2Enabled() ? await ensureWaitingLiveSession(lesson.id) : null,
    });
  }
  const updated = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });

  let liveSession = null;
  if (isLiveWaitingRoomV2Enabled()) {
    liveSession = await ensureWaitingLiveSession(lesson.id);
  }

  await notifyCourseStudents(
    lesson.courseId,
    {
      type: "lesson_starting",
      titleUz: "Kutish xonasi ochildi",
      messageUz: `${lesson.course.titleUz}: ${lesson.titleUz}. Kirib kutishingiz mumkin — efir hali boshlanmagan.`,
      relatedId: lesson.id,
    },
    "t2",
  );

  return NextResponse.json({ lesson: updated, liveSession });
}
