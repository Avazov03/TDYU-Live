import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLessonAccess } from "@/lib/access";
import { isAdminRole } from "@/lib/roles";
import {
  clearWhiteboard,
  pushWhiteboardStroke,
  undoWhiteboard,
  whiteboardStrokes,
} from "@/lib/live-room-extras";
import { entityIdSchema } from "@/lib/entity-id";

const bodySchema = z.object({
  lessonId: entityIdSchema,
  action: z.enum(["stroke", "undo", "clear"]).optional(),
  stroke: z
    .object({
      id: z.string().min(4).max(40),
      d: z.string().min(1).max(8000),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      size: z.number().min(1).max(24),
      tool: z.enum(["pen", "erase"]),
    })
    .optional(),
});

async function canEnter(userId: string, role: string | undefined, lessonId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { course: { select: { id: true, teacher: { select: { userId: true } } } } },
  });
  if (!lesson) return null;
  const teacher = isAdminRole(role) || lesson.course.teacher.userId === userId;
  if (!teacher) {
    const access = await getLessonAccess(userId, lesson.course.id, lesson.status);
    if (!access.ok) return null;
  }
  return { lesson, teacher };
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Kirish kerak" }, { status: 401 });
  const lessonId = new URL(req.url).searchParams.get("lessonId") ?? "";
  if (!entityIdSchema.safeParse(lessonId).success) {
    return NextResponse.json({ error: "Dars topilmadi" }, { status: 400 });
  }
  const gate = await canEnter(session.user.id, session.user.role, lessonId);
  if (!gate) return NextResponse.json({ error: "Ruxsat yo‘q" }, { status: 403 });
  return NextResponse.json({ strokes: whiteboardStrokes(lessonId) });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Kirish kerak" }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Noto‘g‘ri so‘rov" }, { status: 400 });
  const gate = await canEnter(session.user.id, session.user.role, parsed.data.lessonId);
  if (!gate) return NextResponse.json({ error: "Ruxsat yo‘q" }, { status: 403 });
  if (!gate.teacher) return NextResponse.json({ error: "Doskani faqat o‘qituvchi chizadi" }, { status: 403 });
  const { lessonId, action, stroke } = parsed.data;
  if (action === "undo") return NextResponse.json({ strokes: undoWhiteboard(lessonId) });
  if (action === "clear") return NextResponse.json({ strokes: clearWhiteboard(lessonId) });
  if (!stroke) return NextResponse.json({ strokes: whiteboardStrokes(lessonId) });
  return NextResponse.json({ strokes: pushWhiteboardStroke(lessonId, stroke) });
}
