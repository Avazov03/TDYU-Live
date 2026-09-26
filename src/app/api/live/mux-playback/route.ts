import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { authorizeLiveMuxPlayback, getLiveMuxStatus } from "@/lib/live-mux-playback";

const HTTP_BY_REASON = {
  unauthenticated: 401,
  not_found: 404,
  not_enrolled: 403,
  not_live: 409,
  no_playback: 409,
} as const;

/** GET /api/live/mux-playback?lessonId= — live-only public playback ID for authorized viewers. */
export async function GET(req: Request) {
  const session = await auth();
  const lessonId = new URL(req.url).searchParams.get("lessonId")?.trim();
  if (!lessonId) {
    return NextResponse.json({ error: "lessonId kerak" }, { status: 400 });
  }
  const decision = await authorizeLiveMuxPlayback({
    userId: session?.user?.id,
    role: session?.user?.role,
    lessonId,
  });
  const headers = { "Cache-Control": "no-store" };
  if (!decision.ok) {
    return NextResponse.json(
      { code: decision.reason.toUpperCase() },
      { status: HTTP_BY_REASON[decision.reason], headers },
    );
  }
  const status = await getLiveMuxStatus(decision.liveStreamId);
  return NextResponse.json({ playbackId: decision.playbackId, status }, { headers });
}
