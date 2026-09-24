import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLessonAccess } from "@/lib/access";
import {
  applyRoomEvent,
  joinLivePeer,
  leaveLivePeer,
  listLivePeerIds,
  pollLiveRoom,
  pushLiveSignal,
  type SignalPayload,
} from "@/lib/live-rooms";
import { authorizeLiveJoin } from "@/lib/live-auth";
import { isLiveAvPolicyV2Enabled, isLiveWaitingRoomV2Enabled } from "@/lib/feature-flags";
import { livePeerIdForUser, verifyLiveJoinToken } from "@/lib/live-join-token";
import { findActiveLiveSession, isJoinableLiveLessonStatus } from "@/lib/live-session";
import { isAdminRole, isTeacherRole } from "@/lib/roles";
import {
  ATTENDANCE_STALE_MS,
  closeLiveAttendanceInterval,
  closeStaleAttendanceForMissingPeers,
  userIdFromLivePeerId,
} from "@/lib/live-attendance";

/** Teacher A/V controls must use /api/live/av when Wave 2 flag is on. */
const AV_TEACHER_KINDS = new Set(["grant", "revoke", "mute", "camera_off"]);

const eventKind = z.enum([
  "offer",
  "answer",
  "ice",
  "hand",
  "grant",
  "revoke",
  "mute",
  "camera_off",
  "present",
  "chat",
  "state",
  "pointer",
]);

const postSchema = z.object({
  lessonId: z.string().trim().min(1),
  peerId: z.string().trim().min(8).max(80).optional(),
  name: z.string().trim().max(80).optional(),
  action: z.enum(["join", "leave", "signal", "poll", "event"]),
  since: z.number().int().nonnegative().optional(),
  to: z.string().trim().min(1).optional(),
  joinToken: z.string().trim().min(1).optional(),
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

/** Legacy gate when FF_LIVE_WAITING_ROOM_V2 is off. */
async function liveGateLegacy(userId: string, role: string, lessonId: string) {
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

  const { lessonId, name, action, since, to, data, joinToken } = parsed.data;
  const v2 = isLiveWaitingRoomV2Enabled();
  const boundPeerId = livePeerIdForUser(session.user.id);

  let moderator = false;

  if (v2) {
    const authz = await authorizeLiveJoin({
      userId: session.user.id,
      role: session.user.role,
      lessonId,
    });
    if (!authz.ok) {
      return NextResponse.json({ error: authz.message, code: authz.code }, { status: authz.http });
    }
    moderator = authz.moderator;

    if (joinToken) {
      const ver = verifyLiveJoinToken(joinToken, {
        userId: session.user.id,
        lessonId,
        liveSessionId: authz.liveSessionId.startsWith("legacy:")
          ? undefined
          : authz.liveSessionId,
      });
      if (!ver.ok) {
        return NextResponse.json({ error: "Join token yaroqsiz", code: ver.reason }, { status: 403 });
      }
    } else if (action === "join") {
      // join issues presence; token optional on first join (authorizeLiveJoin already ran)
    } else {
      // poll/signal/event without token still require active session + enrollment (checked above)
      const active = await findActiveLiveSession(lessonId);
      if (!active && !isJoinableLiveLessonStatus(authz.lessonStatus)) {
        return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
      }
    }
  } else {
    const gate = await liveGateLegacy(session.user.id, session.user.role, lessonId);
    if (!gate.ok) {
      return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
    }
    moderator = gate.moderator;
  }

  const peerId = boundPeerId;
  const displayName = name?.trim() || session.user.name?.trim() || "Mehmon";
  const role = moderator ? "moderator" : "student";

  if (action === "leave") {
    leaveLivePeer(lessonId, peerId);
    const active = await findActiveLiveSession(lessonId);
    if (active && !moderator) {
      await closeLiveAttendanceInterval({
        userId: session.user.id,
        liveSessionId: active.id,
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "join") {
    const snap = joinLivePeer(lessonId, peerId, displayName, role);
    return NextResponse.json({ ...snap, peerId });
  }

  if (action === "event") {
    if (!data) {
      return NextResponse.json({ error: "Signal to'liq emas" }, { status: 400 });
    }
    if (isLiveAvPolicyV2Enabled() && AV_TEACHER_KINDS.has(data.kind)) {
      return NextResponse.json(
        {
          error: "A/V boshqaruv /api/live/av orqali",
          code: "USE_AV_API",
        },
        { status: 403 },
      );
    }
    // Students cannot forge grant/revoke/mute even when flag is off (room also checks role).
    if (AV_TEACHER_KINDS.has(data.kind) && !moderator) {
      return NextResponse.json({ error: "Faqat ustoz", code: "NOT_MODERATOR" }, { status: 403 });
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

  // Stale disconnect cleanup (Wave 3): peers gone from room longer than stale window.
  const active = await findActiveLiveSession(lessonId);
  if (active?.status === "live") {
    const present = new Set<string>();
    for (const id of listLivePeerIds(lessonId)) {
      const uid = userIdFromLivePeerId(id);
      if (uid) present.add(uid);
    }
    void closeStaleAttendanceForMissingPeers({
      liveSessionId: active.id,
      presentUserIds: present,
      staleBefore: new Date(Date.now() - ATTENDANCE_STALE_MS),
    }).catch(() => undefined);
  }

  return NextResponse.json(snap);
}
