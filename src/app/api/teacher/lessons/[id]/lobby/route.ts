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
import { isLiveWaitingRoomV2Enabled } from "@/lib/feature-flags";

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

  const updated = await prisma.lesson.update({
    where: { id: lesson.id },
    data: { status: "lobby" },
  });

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
