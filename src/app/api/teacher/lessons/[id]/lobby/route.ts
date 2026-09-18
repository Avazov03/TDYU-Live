import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyCourseStudents } from "@/lib/notify";
import { getTeacherForUser } from "@/lib/teacher";

/** Kutish xonasini ochadi — yozuv/Mux hali yo‘q. */
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

  if (lesson.status === "lobby" || lesson.status === "live") {
    return NextResponse.json({ lesson });
  }
  if (lesson.status !== "scheduled") {
    return NextResponse.json({ error: "Bu dars kutishga ochilmaydi" }, { status: 400 });
  }

  const updated = await prisma.lesson.update({
    where: { id: lesson.id },
    data: { status: "lobby" },
  });

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

  return NextResponse.json({ lesson: updated });
}
