import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getStudentOwnedCourses } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import { getTeacherForUser } from "@/lib/teacher";
import { isUniqueConstraint } from "@/lib/prisma-error";

const schema = z.object({
  courseId: z.string().trim().min(1).max(64),
  userId: z.string().trim().min(1).max(64),
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

  const owned = await getStudentOwnedCourses(parsed.data.userId);
  if (!owned.some((row) => row.courseId === course.id)) {
    return NextResponse.json(
      { error: "Bu o‘quvchi kursga yozilmagan", code: "NOT_ENROLLED" },
      { status: 409 },
    );
  }

  const where = { userId_courseId: { userId: parsed.data.userId, courseId: course.id } };
  const existing = await prisma.certificate.findUnique({ where });
  if (existing) return NextResponse.json({ certificate: existing, already: true });

  let cert;
  try {
    cert = await prisma.certificate.create({
      data: { userId: parsed.data.userId, courseId: course.id, issuedBy: session.user.id },
    });
  } catch (err) {
    if (!isUniqueConstraint(err)) throw err;
    const raced = await prisma.certificate.findUniqueOrThrow({ where });
    return NextResponse.json({ certificate: raced, already: true });
  }

  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (user) {
    await notifyUser({
      userId: user.id,
      type: "certificate",
      titleUz: "Sertifikat berildi",
      messageUz: course.titleUz,
      relatedId: cert.id,
      email: user.email,
      telegramChatId: user.telegramChatId,
    });
  }

  return NextResponse.json({ certificate: cert });
}
