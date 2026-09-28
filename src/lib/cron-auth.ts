import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Fail-closed CRON_SECRET check (Bearer header or `?secret=`).
 * Returns an error response, or null when the caller is authorized.
 */
export function cronAuthError(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET yo‘q" }, { status: 503 });
  }
  const header = req.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const query = new URL(req.url).searchParams.get("secret") ?? "";
  if (!safeEqual(bearer, secret) && !safeEqual(query, secret)) {
    return NextResponse.json({ error: "Ruxsat yo‘q" }, { status: 401 });
  }
  return null;
}
