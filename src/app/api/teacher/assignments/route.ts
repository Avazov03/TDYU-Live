import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyCourseStudents } from "@/lib/notify";
import { getTeacherForUser } from "@/lib/teacher";

const schema = z.object({
  courseId: z.string().uuid(),
  titleUz: z.string().trim().min(2),
  descriptionUz: z.string().trim().min(2),
  dueAt: z.string(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }
  const teacher = await getTeacherForUser(session.user.id);
  if (!teacher) return NextResponse.json({ error: "Profil yo'q" }, { status: 404 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Noto'g'ri ma'lumot" }, { status: 400 });

  const course = await prisma.course.findFirst({
    where: { id: parsed.data.courseId, teacherId: teacher.id },
  });
  if (!course) return NextResponse.json({ error: "Kurs topilmadi" }, { status: 404 });

  const assignment = await prisma.assignment.create({
    data: {
      courseId: course.id,
      titleUz: parsed.data.titleUz,
      descriptionUz: parsed.data.descriptionUz,
      dueAt: new Date(parsed.data.dueAt),
    },
  });

  await notifyCourseStudents(course.id, {
    type: "assignment",
    titleUz: "Yangi topshiriq",
    messageUz: parsed.data.titleUz,
    relatedId: assignment.id,
  });

  return NextResponse.json({ assignment }, { status: 201 });
}
