import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import { getTeacherForUser } from "@/lib/teacher";

const schema = z.object({
  submissionId: z.string().uuid(),
  grade: z.number().int().min(0).max(100),
  teacherNote: z.string().optional(),
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

  const submission = await prisma.submission.findFirst({
    where: {
      id: parsed.data.submissionId,
      assignment: { course: { teacherId: teacher.id } },
    },
    include: { user: true, assignment: true },
  });
  if (!submission) return NextResponse.json({ error: "Javob topilmadi" }, { status: 404 });

  const updated = await prisma.submission.update({
    where: { id: submission.id },
    data: {
      grade: parsed.data.grade,
      teacherNote: parsed.data.teacherNote || null,
      gradedAt: new Date(),
    },
  });

  await notifyUser({
    userId: submission.userId,
    type: "grade",
    titleUz: "Baho qo'yildi",
    messageUz: `${submission.assignment.titleUz}: ${parsed.data.grade}`,
    relatedId: submission.id,
    email: submission.user.email,
    telegramChatId: submission.user.telegramChatId,
  });

  return NextResponse.json({ submission: updated });
}
