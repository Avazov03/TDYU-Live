import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLessonAccess } from "@/lib/access";
import { canUseLiveChat, isPriorityTier } from "@/lib/tariffs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const items = await prisma.chatMessage.findMany({
    where: { lessonId: id },
    include: { user: { select: { fullName: true } } },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: 80,
  });
  return NextResponse.json({ items });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Kirish kerak" }, { status: 401 });

  const { id } = await params;
  const lesson = await prisma.lesson.findUnique({ where: { id } });
  if (!lesson) return NextResponse.json({ error: "Dars topilmadi" }, { status: 404 });

  const access = await getLessonAccess(session.user.id, lesson.courseId, lesson.status);
  if (!access.ok || !canUseLiveChat(access.tier)) {
    return NextResponse.json({ error: "Chat uchun 2 yoki 3-tarif kerak" }, { status: 403 });
  }

  const body = await req.json();
  const text = String(body.text ?? "").trim();
  if (text.length < 1 || text.length > 500) {
    return NextResponse.json({ error: "Matn noto'g'ri" }, { status: 400 });
  }

  const item = await prisma.chatMessage.create({
    data: {
      lessonId: id,
      userId: session.user.id,
      text,
      priority: isPriorityTier(access.tier),
    },
    include: { user: { select: { fullName: true } } },
  });
  return NextResponse.json({ item }, { status: 201 });
}
