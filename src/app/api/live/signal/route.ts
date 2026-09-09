import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLessonAccess } from "@/lib/access";
import {
  joinLivePeer,
  leaveLivePeer,
  pollLiveRoom,
  pushLiveSignal,
} from "@/lib/live-rooms";
import { isAdminRole, isTeacherRole } from "@/lib/roles";

const postSchema = z.object({
  lessonId: z.string().trim().min(1),
  peerId: z.string().trim().min(8).max(80),
  name: z.string().trim().max(80).optional(),
  action: z.enum(["join", "leave", "signal", "poll"]),
  since: z.number().int().nonnegative().optional(),
  to: z.string().trim().min(1).optional(),
  data: z
    .object({
      kind: z.enum(["offer", "answer", "ice"]),
      sdp: z.string().optional(),
      candidate: z.unknown().optional(),
    })
    .optional(),
});

async function canJoinLive(userId: string, role: string, lessonId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { course: { include: { teacher: true } } },
  });
  if (!lesson || lesson.status !== "live") return false;
  if (isAdminRole(role)) return true;
  if (isTeacherRole(role) && lesson.course.teacher.userId === userId) return true;
  const access = await getLessonAccess(userId, lesson.courseId, lesson.status);
  return access.ok;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Kirish kerak" }, { status: 401 });
  }

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Noto'g'ri ma'lumot" }, { status: 400 });
  }

  const { lessonId, peerId, name, action, since, to, data } = parsed.data;
  const allowed = await canJoinLive(session.user.id, session.user.role, lessonId);
  if (!allowed) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }

  const displayName = name?.trim() || session.user.name?.trim() || "Mehmon";

  if (action === "leave") {
    leaveLivePeer(lessonId, peerId);
    return NextResponse.json({ ok: true });
  }

  if (action === "join") {
    const snap = joinLivePeer(lessonId, peerId, displayName);
    return NextResponse.json(snap);
  }

  if (action === "signal") {
    if (!to || !data) {
      return NextResponse.json({ error: "Signal to'liq emas" }, { status: 400 });
    }
    pushLiveSignal(lessonId, peerId, to, {
      kind: data.kind,
      sdp: data.sdp,
      candidate: data.candidate as { candidate?: string; sdpMid?: string | null; sdpMLineIndex?: number | null } | undefined,
    });
    return NextResponse.json({ ok: true });
  }

  const snap = pollLiveRoom(lessonId, peerId, since ?? 0);
  return NextResponse.json(snap);
}
