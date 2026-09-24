/**
 * Short-lived live join token (Phase 7 Wave 1).
 * Tied to user + lesson + liveSession. Not a permanent access credential.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export type LiveJoinTokenPayload = {
  uid: string;
  lid: string;
  sid: string;
  exp: number;
};

const TTL_SEC = 15 * 60;

function secret(): string {
  const s =
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    process.env.LIVE_JOIN_TOKEN_SECRET?.trim();
  if (!s) throw new Error("NEXTAUTH_SECRET (or AUTH_SECRET) required for live join tokens");
  return s;
}

function b64url(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b.toString("base64url");
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function issueLiveJoinToken(input: {
  userId: string;
  lessonId: string;
  liveSessionId: string;
  nowSec?: number;
  ttlSec?: number;
}): string {
  const now = input.nowSec ?? Math.floor(Date.now() / 1000);
  const payload: LiveJoinTokenPayload = {
    uid: input.userId,
    lid: input.lessonId,
    sid: input.liveSessionId,
    exp: now + (input.ttlSec ?? TTL_SEC),
  };
  const body = b64url(JSON.stringify(payload));
  const sig = sign(body);
  return `${body}.${sig}`;
}

export function verifyLiveJoinToken(
  token: string,
  expect: { userId: string; lessonId: string; liveSessionId?: string },
  nowSec = Math.floor(Date.now() / 1000),
): { ok: true; payload: LiveJoinTokenPayload } | { ok: false; reason: string } {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [body, sig] = parts;
  const expected = sign(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: "bad_sig" };
    }
  } catch {
    return { ok: false, reason: "bad_sig" };
  }
  let payload: LiveJoinTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as LiveJoinTokenPayload;
  } catch {
    return { ok: false, reason: "bad_payload" };
  }
  if (!payload.uid || !payload.lid || !payload.sid || !payload.exp) {
    return { ok: false, reason: "incomplete" };
  }
  if (payload.exp < nowSec) return { ok: false, reason: "expired" };
  if (payload.uid !== expect.userId) return { ok: false, reason: "user_mismatch" };
  if (payload.lid !== expect.lessonId) return { ok: false, reason: "lesson_mismatch" };
  if (expect.liveSessionId && payload.sid !== expect.liveSessionId) {
    return { ok: false, reason: "session_mismatch" };
  }
  return { ok: true, payload };
}

/**
 * Deterministic peer id bound to authenticated user (not client-chosen).
 * Uses the full normalized UUID hex (32 chars) — never truncate.
 * Truncating to 24 chars collided staging fixtures that share a UUID prefix
 * (e.g. …6602 teacher vs …6611 student → same u_a6666…66666 peer).
 */
export function livePeerIdForUser(userId: string): string {
  const compact = userId.trim().replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(compact)) {
    // Non-UUID ids (tests / legacy): still prefix and keep full string, bounded.
    const safe = compact.replace(/[^0-9a-z]/gi, "").slice(0, 64) || "unknown";
    return `u_${safe}`;
  }
  return `u_${compact}`;
}
