/**
 * Phase 8 Recording Wave 2 — Mux signed playback JWT (RS256).
 *
 * No @mux/mux-node in this repo — signs with Node crypto using Mux URL signing key.
 * Env:
 *   MUX_SIGNING_KEY_ID      — kid
 *   MUX_SIGNING_PRIVATE_KEY — base64-encoded PEM (Mux create-signing-key shape) or raw PEM
 *
 * Never send private key to the browser.
 */

import { createSign, createPrivateKey, createHmac, timingSafeEqual } from "crypto";

export const MUX_PLAYBACK_TOKEN_TTL_SEC = 10 * 60; // 10 minutes (5–15 target)

export function isMuxSigningConfigured(): boolean {
  return Boolean(
    process.env.MUX_SIGNING_KEY_ID?.trim() && process.env.MUX_SIGNING_PRIVATE_KEY?.trim(),
  );
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function loadMuxPrivateKey() {
  const raw = process.env.MUX_SIGNING_PRIVATE_KEY?.trim();
  if (!raw) throw new Error("MUX_SIGNING_PRIVATE_KEY missing");
  // Mux returns base64(PEM). Accept raw PEM for local/dev.
  const pem = raw.includes("BEGIN")
    ? raw.replace(/\\n/g, "\n")
    : Buffer.from(raw, "base64").toString("utf8");
  return createPrivateKey(pem);
}

/**
 * Sign a Mux Video playback JWT for a known playback ID.
 * Caller MUST authorize before invoking — this never checks Enrollment.
 */
export function signMuxPlaybackToken(input: {
  playbackId: string;
  ttlSec?: number;
  nowSec?: number;
}): { token: string; expiresAt: Date; ttlSec: number } {
  if (!input.playbackId || input.playbackId.startsWith("demo_")) {
    throw new Error("INVALID_PLAYBACK_ID");
  }
  const keyId = process.env.MUX_SIGNING_KEY_ID?.trim();
  if (!keyId || !isMuxSigningConfigured()) {
    throw new Error("SIGNING_NOT_CONFIGURED");
  }

  const ttlSec = input.ttlSec ?? MUX_PLAYBACK_TOKEN_TTL_SEC;
  const now = input.nowSec ?? Math.floor(Date.now() / 1000);
  const exp = now + ttlSec;

  const header = { alg: "RS256", typ: "JWT", kid: keyId };
  const payload = {
    sub: input.playbackId,
    aud: "v",
    exp,
    kid: keyId,
  };

  const data = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = createSign("RSA-SHA256").update(data).sign(loadMuxPrivateKey());
  const token = `${data}.${base64url(signature)}`;

  return { token, expiresAt: new Date(exp * 1000), ttlSec };
}

export function muxSignedPlayerUrl(playbackId: string, token: string): string {
  return `https://player.mux.com/${playbackId}?token=${encodeURIComponent(token)}`;
}

/** Public URL — Wave 2 must not use this for student VOD when signed flag is on. */
export function muxPublicPlayerUrl(playbackId: string): string {
  return `https://player.mux.com/${playbackId}`;
}

/**
 * Staging/E2E fixture token when Mux signing keys are absent.
 * HMAC over playbackId+exp — NOT a Mux CDN token. Authz still required upstream.
 */
export function signFixturePlaybackToken(input: {
  playbackId: string;
  userId: string;
  recordingId: string;
  ttlSec?: number;
  nowSec?: number;
}): { token: string; expiresAt: Date; ttlSec: number; mode: "fixture" } {
  const secret =
    process.env.RECORDING_PLAYBACK_FIXTURE_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    "lexify-recording-fixture-dev-only";
  const ttlSec = input.ttlSec ?? MUX_PLAYBACK_TOKEN_TTL_SEC;
  const now = input.nowSec ?? Math.floor(Date.now() / 1000);
  const exp = now + ttlSec;
  const body = `${input.recordingId}.${input.userId}.${input.playbackId}.${exp}`;
  const sig = createHmac("sha256", secret).update(body).digest("hex");
  const token = `fixture.${base64url(body)}.${sig}`;
  return { token, expiresAt: new Date(exp * 1000), ttlSec, mode: "fixture" };
}

function base64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function verifyFixturePlaybackToken(token: string): {
  ok: true;
  recordingId: string;
  userId: string;
  playbackId: string;
  exp: number;
} | { ok: false; code: string } {
  if (!token.startsWith("fixture.")) return { ok: false, code: "NOT_FIXTURE" };
  const rest = token.slice("fixture.".length);
  const lastDot = rest.lastIndexOf(".");
  if (lastDot <= 0) return { ok: false, code: "BAD_FORMAT" };
  const bodyB64 = rest.slice(0, lastDot);
  const sig = rest.slice(lastDot + 1);
  let body: string;
  try {
    body = base64urlDecode(bodyB64).toString("utf8");
  } catch {
    return { ok: false, code: "BAD_FORMAT" };
  }
  const secret =
    process.env.RECORDING_PLAYBACK_FIXTURE_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    "lexify-recording-fixture-dev-only";
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, code: "BAD_SIGNATURE" };
  }
  const [recordingId, userId, playbackId, expStr] = body.split(".");
  const exp = Number(expStr);
  if (!recordingId || !userId || !playbackId || !Number.isFinite(exp)) {
    return { ok: false, code: "BAD_CLAIMS" };
  }
  if (Math.floor(Date.now() / 1000) > exp) return { ok: false, code: "EXPIRED" };
  return { ok: true, recordingId, userId, playbackId, exp };
}

/** Decode JWT payload without verify (tests / exp inspection only). */
export function decodeJwtPayloadUnsafe(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const json = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
      "utf8",
    );
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}
