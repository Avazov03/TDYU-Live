/**
 * Mux webhook signature verification (HMAC-SHA256).
 * Header format: Mux-Signature: t=<unix>,v1=<hex>
 */

import { createHmac, timingSafeEqual } from "crypto";

export function parseMuxSignatureHeader(header: string | null): {
  timestamp: string;
  signatures: string[];
} | null {
  if (!header?.trim()) return null;
  let timestamp = "";
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=").map((s) => s.trim());
    if (k === "t") timestamp = v ?? "";
    if (k === "v1" && v) signatures.push(v);
  }
  if (!timestamp || signatures.length === 0) return null;
  return { timestamp, signatures };
}

export function verifyMuxWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | null;
  secret: string;
  /** Reject events older than this (seconds). Default 300. */
  maxSkewSeconds?: number;
  nowSeconds?: number;
}): { ok: true } | { ok: false; code: string } {
  if (!input.secret) return { ok: false, code: "NO_SECRET" };
  const parsed = parseMuxSignatureHeader(input.signatureHeader);
  if (!parsed) return { ok: false, code: "BAD_HEADER" };

  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const ts = Number(parsed.timestamp);
  if (!Number.isFinite(ts)) return { ok: false, code: "BAD_TIMESTAMP" };
  const skew = input.maxSkewSeconds ?? 300;
  if (Math.abs(now - ts) > skew) return { ok: false, code: "TIMESTAMP_SKEW" };

  const payload = `${parsed.timestamp}.${input.rawBody}`;
  const expected = createHmac("sha256", input.secret).update(payload, "utf8").digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");

  let matched = false;
  for (const sig of parsed.signatures) {
    const got = Buffer.from(sig, "utf8");
    if (got.length === expectedBuf.length && timingSafeEqual(got, expectedBuf)) {
      matched = true;
      break;
    }
  }
  if (!matched) return { ok: false, code: "BAD_SIGNATURE" };
  return { ok: true };
}
