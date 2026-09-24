import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit-log";
import { isLiveAvPolicyV2Enabled, isLiveWaitingRoomV2Enabled } from "@/lib/feature-flags";
import { authorizeLiveJoin } from "@/lib/live-auth";
import { livePeerIdForUser } from "@/lib/live-join-token";
import { applyAvControl, joinLivePeer, type AvControlAction } from "@/lib/live-rooms";
import { findActiveLiveSession } from "@/lib/live-session";

const postSchema = z.object({
  lessonId: z.string().trim().min(1),
  action: z.enum(["raise_hand", "lower_hand", "grant", "revoke", "mute", "camera_off"]),
  targetPeerId: z.string().trim().min(8).max(80).optional(),
  mic: z.boolean().optional(),
  cam: z.boolean().optional(),
  name: z.string().trim().max(80).optional(),
});

const TEACHER_ACTIONS = new Set<AvControlAction>(["grant", "revoke", "mute", "camera_off"]);

/**
 * Phase 7 Live Wave 2 — server-authorized A/V policy actions.
 * Requires FF_LIVE_AV_POLICY_V2 (+ Wave 1 waiting-room auth).
 */
export async function POST(req: Request) {
  if (!isLiveAvPolicyV2Enabled()) {
    return NextResponse.json(
      { error: "A/V policy o‘chiq", code: "FLAG_OFF" },
      { status: 404 },
    );
  }
  if (!isLiveWaitingRoomV2Enabled()) {
    return NextResponse.json(
      { error: "Live waiting room o‘chiq", code: "WAITING_FLAG_OFF" },
      { status: 403 },
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Kirish kerak" }, { status: 401 });
  }

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Noto'g'ri ma'lumot" }, { status: 400 });
  }

  const { lessonId, action, targetPeerId, mic, cam, name } = parsed.data;

  const authz = await authorizeLiveJoin({
    userId: session.user.id,
    role: session.user.role,
    lessonId,
  });
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, code: authz.code }, { status: authz.http });
  }

  const active = await findActiveLiveSession(lessonId);
  if (!active || active.status === "ended" || active.status === "abandoned") {
    return NextResponse.json(
      { error: "Jonli dars yakunlangan", code: "SESSION_ENDED" },
      { status: 403 },
    );
  }

  if (TEACHER_ACTIONS.has(action) && !authz.moderator) {
    return NextResponse.json(
      { error: "Faqat ustoz", code: "NOT_MODERATOR" },
      { status: 403 },
    );
  }

  if ((action === "raise_hand" || action === "lower_hand") && authz.moderator) {
    return NextResponse.json(
      { error: "Ustoz qo‘l ko‘tarmaydi", code: "MODERATOR_NO_HAND" },
      { status: 400 },
    );
  }

  if (TEACHER_ACTIONS.has(action)) {
    if (!targetPeerId) {
      return NextResponse.json({ error: "Ishtirokchi tanlanmagan" }, { status: 400 });
    }
    // Stable identity: peerId must be u_<userId> form — reject spoofed targets later in room.
    if (!targetPeerId.startsWith("u_")) {
      return NextResponse.json(
        { error: "Noto‘g‘ri ishtirokchi", code: "BAD_TARGET" },
        { status: 400 },
      );
    }
  }

  const actorPeerId = livePeerIdForUser(session.user.id);
  const displayName = name?.trim() || session.user.name?.trim() || "Mehmon";
  const role = authz.moderator ? "moderator" : "student";

  // Ensure actor is present in the in-memory room (join may have raced).
  joinLivePeer(lessonId, actorPeerId, displayName, role);

  const result = applyAvControl({
    lessonId,
    actorPeerId,
    action,
    targetPeerId,
    mic,
    cam,
  });

  if (!result.ok) {
    const http = result.code === "NOT_MODERATOR" ? 403 : 400;
    return NextResponse.json({ error: result.message, code: result.code }, { status: http });
  }

  if (TEACHER_ACTIONS.has(action)) {
    await writeAuditLog({
      actorId: session.user.id,
      action: `live.av.${action}`,
      entityType: "LiveSession",
      entityId: authz.liveSessionId,
      metadata: {
        lessonId,
        courseId: authz.courseId,
        liveSessionId: authz.liveSessionId,
        targetPeerId: targetPeerId ?? null,
        mic: mic ?? null,
        cam: cam ?? null,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    action,
    ...result.snap,
    peerId: actorPeerId,
  });
}
