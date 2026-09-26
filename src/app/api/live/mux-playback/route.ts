import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  authorizeLiveMuxPlayback,
  getLiveMuxStatus,
  resolveLivePlaybackSource,
} from "@/lib/live-mux-playback";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const HTTP_BY_REASON = {
  disabled: 404,
  unauthenticated: 401,
  not_found: 404,
  not_enrolled: 403,
  not_live: 409,
  no_playback: 409,
} as const;

/** Client polls every 15–30 s; 12/min per user+lesson leaves room for refreshes and retries. */
const LIVE_MUX_POLL_LIMIT = 12;
const LIVE_MUX_POLL_WINDOW_MS = 60_000;
const RETRY_AFTER_SEC = 30;

/**
 * GET /api/live/mux-playback?lessonId= — live-only status for authorized viewers.
 * The player URL is included only while the Mux stream is active.
 */
export async function GET(req: Request) {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  const lessonId = new URL(req.url).searchParams.get("lessonId")?.trim();
  if (!lessonId) {
    return NextResponse.json({ code: "LESSON_ID_REQUIRED" }, { status: 400, headers });
  }
  const session = await auth();
  const userId = session?.user?.id;
  const bucket = `live-mux:${userId ?? `ip:${getClientIp(req)}`}:${lessonId}`;
  if (!rateLimit(bucket, LIVE_MUX_POLL_LIMIT, LIVE_MUX_POLL_WINDOW_MS)) {
    return NextResponse.json(
      { code: "RATE_LIMITED" },
      { status: 429, headers: { ...headers, "Retry-After": String(RETRY_AFTER_SEC) } },
    );
  }

  const decision = await authorizeLiveMuxPlayback({ userId, role: session?.user?.role, lessonId });
  if (!decision.ok) {
    return NextResponse.json(
      { code: decision.reason.toUpperCase() },
      { status: HTTP_BY_REASON[decision.reason], headers },
    );
  }
  const { status, degraded } = await getLiveMuxStatus(decision.liveStreamId, lessonId);
  const playback = status === "active" ? resolveLivePlaybackSource(decision.playbackId) : null;
  return NextResponse.json(
    { status, degraded: degraded !== null && degraded !== "demo", playback },
    { headers },
  );
}
