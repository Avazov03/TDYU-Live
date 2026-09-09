import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTeacherForUser } from "@/lib/teacher";
import { ensureTeacherWorkspace } from "@/lib/teacher-workspace";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }
  const teacher = await getTeacherForUser(session.user.id);
  if (!teacher) return NextResponse.json({ error: "Profil yo'q" }, { status: 404 });

  const courseId = await ensureTeacherWorkspace(teacher.id);
  if (!courseId) return NextResponse.json({ error: "Kurs ochilmadi" }, { status: 500 });

  const live = await prisma.lesson.findFirst({
    where: { status: "live", course: { teacherId: teacher.id } },
  });
  if (live) return NextResponse.json({ lesson: live, alreadyLive: true });

  const lesson = await prisma.lesson.create({
    data: {
      courseId,
      titleUz: "Jonli dars",
      scheduledAt: new Date(),
    },
  });
  return NextResponse.json({ lesson }, { status: 201 });
}
