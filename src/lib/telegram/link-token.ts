import { createHmac, timingSafeEqual } from "node:crypto";

/** Telegram deep-link start payloads are limited to 64 chars of [A-Za-z0-9_-]. */
const SIG_LENGTH = 20;

function secret(): string | null {
  const s = process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  return s && s.length >= 16 ? s : null;
}

function sign(userId: string, key: string): string {
  return createHmac("sha256", key).update(`tg-link:${userId}`).digest("base64url").slice(0, SIG_LENGTH);
}

/** `link_<userId>_<sig>` — only the account owner can obtain it (rendered on their settings page). */
export function telegramLinkPayload(userId: string): string | null {
  const key = secret();
  return key ? `link_${userId}_${sign(userId, key)}` : null;
}

/** Returns the userId for a valid signed payload; a bare `link_<userId>` is rejected. */
export function verifyTelegramLinkPayload(payload: string): string | null {
  const key = secret();
  const m = /^link_([0-9a-f-]{36})_([A-Za-z0-9_-]{20})$/i.exec(payload.trim());
  if (!key || !m) return null;
  const expected = Buffer.from(sign(m[1], key));
  const given = Buffer.from(m[2]);
  return expected.length === given.length && timingSafeEqual(expected, given) ? m[1] : null;
}
