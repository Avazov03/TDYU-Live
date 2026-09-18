import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTeacherForUser } from "@/lib/teacher";

const patchSchema = z.object({
  titleUz: z.string().trim().min(2).optional(),
  summaryUz: z.string().trim().max(500).optional().or(z.literal("")),
  coverUrl: z.string().trim().url().optional().or(z.literal("")),
  scheduledAt: z.string().optional(),
});

async function ownedLesson(userId: string, lessonId: string) {
  const teacher = await getTeacherForUser(userId);
  if (!teacher) return null;
  return prisma.lesson.findFirst({
    where: { id: lessonId, course: { teacherId: teacher.id } },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }

  const { id } = await params;
  const lesson = await ownedLesson(session.user.id, id);
  if (!lesson) return NextResponse.json({ error: "Dars topilmadi" }, { status: 404 });
  if (lesson.status === "live" || lesson.status === "lobby") {
    return NextResponse.json({ error: "Kutish/jonli efirda tahrirlab bo'lmaydi" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Noto'g'ri ma'lumot" }, { status: 400 });
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "O'zgarish yo'q" }, { status: 400 });
  }

  if (parsed.data.scheduledAt && lesson.status !== "scheduled") {
    return NextResponse.json({ error: "Faqat rejadagi dars vaqtini o'zgartirish mumkin" }, { status: 400 });
  }

  const updated = await prisma.lesson.update({
    where: { id: lesson.id },
    data: {
      ...(parsed.data.titleUz != null ? { titleUz: parsed.data.titleUz } : {}),
      ...(parsed.data.summaryUz !== undefined ? { summaryUz: parsed.data.summaryUz || null } : {}),
      ...(parsed.data.coverUrl !== undefined ? { coverUrl: parsed.data.coverUrl || null } : {}),
      ...(parsed.data.scheduledAt ? { scheduledAt: new Date(parsed.data.scheduledAt) } : {}),
    },
  });

  return NextResponse.json({ lesson: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }

  const { id } = await params;
  const lesson = await ownedLesson(session.user.id, id);
  if (!lesson) return NextResponse.json({ error: "Dars topilmadi" }, { status: 404 });
  if (lesson.status !== "scheduled") {
    return NextResponse.json({ error: "Faqat rejadagi darsni o'chirish mumkin" }, { status: 400 });
  }

  await prisma.lesson.delete({ where: { id: lesson.id } });
  return NextResponse.json({ ok: true });
}
