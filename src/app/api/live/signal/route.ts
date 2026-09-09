import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLessonAccess } from "@/lib/access";
import {
  applyRoomEvent,
  joinLivePeer,
  leaveLivePeer,
  pollLiveRoom,
  pushLiveSignal,
  type SignalPayload,
} from "@/lib/live-rooms";
import { isAdminRole, isTeacherRole } from "@/lib/roles";

const eventKind = z.enum([
  "offer",
  "answer",
  "ice",
  "hand",
  "grant",
  "revoke",
  "present",
  "chat",
  "state",
  "pointer",
]);

const postSchema = z.object({
  lessonId: z.string().trim().min(1),
  peerId: z.string().trim().min(8).max(80),
  name: z.string().trim().max(80).optional(),
  action: z.enum(["join", "leave", "signal", "poll", "event"]),
  since: z.number().int().nonnegative().optional(),
  to: z.string().trim().min(1).optional(),
  data: z
    .object({
      kind: eventKind,
      sdp: z.string().optional(),
      candidate: z.unknown().optional(),
      handRaised: z.boolean().optional(),
      targetId: z.string().optional(),
      mic: z.boolean().optional(),
      cam: z.boolean().optional(),
      present: z
        .object({
          fileUrl: z.string(),
          fileName: z.string(),
          mime: z.string(),
        })
        .nullable()
        .optional(),
      text: z.string().max(400).optional(),
      micOn: z.boolean().optional(),
      camOn: z.boolean().optional(),
      pointerOn: z.boolean().optional(),
      x: z.number().min(0).max(1).optional(),
      y: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

async function liveGate(userId: string, role: string, lessonId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { course: { include: { teacher: true } } },
  });
  if (!lesson || lesson.status !== "live") return { ok: false, moderator: false };
  const moderator =
    isAdminRole(role) || (isTeacherRole(role) && lesson.course.teacher.userId === userId);
  if (moderator) return { ok: true, moderator: true };
  const access = await getLessonAccess(userId, lesson.courseId, lesson.status);
  return { ok: access.ok, moderator: false };
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
  const gate = await liveGate(session.user.id, session.user.role, lessonId);
  if (!gate.ok) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }

  const displayName = name?.trim() || session.user.name?.trim() || "Mehmon";
  const role = gate.moderator ? "moderator" : "student";

  if (action === "leave") {
    leaveLivePeer(lessonId, peerId);
    return NextResponse.json({ ok: true });
  }

  if (action === "join") {
    const snap = joinLivePeer(lessonId, peerId, displayName, role);
    return NextResponse.json(snap);
  }

  if (action === "event") {
    if (!data) {
      return NextResponse.json({ error: "Signal to'liq emas" }, { status: 400 });
    }
    const snap = applyRoomEvent(lessonId, peerId, data as SignalPayload);
    return NextResponse.json(snap);
  }

  if (action === "signal") {
    if (!to || !data) {
      return NextResponse.json({ error: "Signal to'liq emas" }, { status: 400 });
    }
    if (data.kind !== "offer" && data.kind !== "answer" && data.kind !== "ice") {
      return NextResponse.json({ error: "Noto'g'ri signal" }, { status: 400 });
    }
    pushLiveSignal(lessonId, peerId, to, {
      kind: data.kind,
      sdp: data.sdp,
      candidate: data.candidate as SignalPayload["candidate"],
    });
    return NextResponse.json({ ok: true });
  }

  const snap = pollLiveRoom(lessonId, peerId, since ?? 0);
  return NextResponse.json(snap);
}
