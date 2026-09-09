import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import { getTeacherForUser } from "@/lib/teacher";

const schema = z.object({
  courseId: z.string().uuid(),
  userId: z.string().uuid(),
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

  const cert = await prisma.certificate.upsert({
    where: { userId_courseId: { userId: parsed.data.userId, courseId: course.id } },
    update: { issuedAt: new Date(), issuedBy: session.user.id },
    create: {
      userId: parsed.data.userId,
      courseId: course.id,
      issuedBy: session.user.id,
    },
  });

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
