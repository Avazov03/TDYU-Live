import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTeacherForUser } from "@/lib/teacher";

const schema = z.object({
  courseId: z.string().trim().min(1),
  titleUz: z.string().trim().min(2),
  summaryUz: z.string().trim().max(500).optional().or(z.literal("")),
  coverUrl: z.string().trim().url().optional().or(z.literal("")),
  scheduledAt: z.string(),
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

  const lesson = await prisma.lesson.create({
    data: {
      courseId: course.id,
      titleUz: parsed.data.titleUz,
      summaryUz: parsed.data.summaryUz || null,
      coverUrl: parsed.data.coverUrl || null,
      scheduledAt: new Date(parsed.data.scheduledAt),
    },
  });
  return NextResponse.json({ lesson }, { status: 201 });
}
