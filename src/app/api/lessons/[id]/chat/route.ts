import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLessonAccess } from "@/lib/access";
import { getEnrollmentAccessMode } from "@/lib/feature-flags";
import { canUseLiveChat, isPriorityTier } from "@/lib/tariffs";
import { isAdminRole, isTeacherRole } from "@/lib/roles";

async function assertChatReadAccess(lessonId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Kirish kerak" }, { status: 401 }) };
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { course: { include: { teacher: true } } },
  });
  if (!lesson) {
    return { error: NextResponse.json({ error: "Dars topilmadi" }, { status: 404 }) };
  }

  const staff =
    isAdminRole(session.user.role) ||
    (isTeacherRole(session.user.role) && lesson.course.teacher.userId === session.user.id);

  if (!staff) {
    const access = await getLessonAccess(session.user.id, lesson.courseId, lesson.status);
    if (!access.ok) {
      return { error: NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 }) };
    }
  }

  return { session, lesson, staff };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gate = await assertChatReadAccess(id);
  if ("error" in gate && gate.error) return gate.error;

  const items = await prisma.chatMessage.findMany({
    where: { lessonId: id },
    include: { user: { select: { fullName: true } } },
    orderBy: [{ createdAt: "asc" }],
    take: 120,
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
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: { course: { include: { teacher: true } } },
  });
  if (!lesson) return NextResponse.json({ error: "Dars topilmadi" }, { status: 404 });

  const staff =
    isAdminRole(session.user.role) ||
    (isTeacherRole(session.user.role) && lesson.course.teacher.userId === session.user.id);

  let priority = Boolean(staff);
  if (!staff) {
    const access = await getLessonAccess(session.user.id, lesson.courseId, lesson.status);
    if (!access.ok) {
      return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
    }
    const mode = getEnrollmentAccessMode();
    // Enrollment-authoritative: seat grants chat; tariff priority is optional.
    if (mode === "enrollment") {
      priority = false;
    } else if (!canUseLiveChat(access.tier)) {
      return NextResponse.json({ error: "Chat uchun 2 yoki 3-tarif kerak" }, { status: 403 });
    } else {
      priority = isPriorityTier(access.tier);
    }
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
      priority,
    },
    include: { user: { select: { fullName: true } } },
  });
  return NextResponse.json({ item }, { status: 201 });
}
