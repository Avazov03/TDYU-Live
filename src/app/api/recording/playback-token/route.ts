import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { issueRecordingPlaybackToken } from "@/lib/recording-playback-auth";
import { isRecordingSignedPlaybackV1Enabled } from "@/lib/feature-flags";

const bodySchema = z.object({
  recordingId: z.string().trim().uuid().optional(),
  lessonId: z.string().trim().uuid().optional(),
  /** Forbidden — server rejects if present. */
  playbackId: z.string().optional(),
});

/**
 * POST /api/recording/playback-token
 * Issues a short-lived Mux (or fixture) playback token after Enrollment + publish checks.
 * Never accepts client playbackId for signing.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Kirish kerak", code: "UNAUTHENTICATED" }, { status: 401 });
  }

  if (!isRecordingSignedPlaybackV1Enabled()) {
    return NextResponse.json({ error: "Feature disabled", code: "FEATURE_DISABLED" }, { status: 503 });
  }

  const ip = getClientIp(req);
  if (!rateLimit(`rec-play:${session.user.id}:${ip}`, 40, 60_000)) {
    return NextResponse.json({ error: "Too many requests", code: "RATE_LIMITED" }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", code: "BAD_REQUEST" }, { status: 400 });
  }

  if (parsed.data.playbackId) {
    return NextResponse.json(
      { error: "playbackId not accepted", code: "PLAYBACK_ID_NOT_ACCEPTED" },
      { status: 400 },
    );
  }

  if (!parsed.data.recordingId && !parsed.data.lessonId) {
    return NextResponse.json(
      { error: "recordingId or lessonId required", code: "RECORDING_ID_REQUIRED" },
      { status: 400 },
    );
  }

  const result = await issueRecordingPlaybackToken({
    userId: session.user.id,
    userRole: session.user.role,
    recordingId: parsed.data.recordingId,
    lessonId: parsed.data.lessonId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.code, code: result.code }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    recordingId: result.recordingId,
    lessonId: result.lessonId,
    mode: result.mode,
    token: result.token,
    playerUrl: result.playerUrl,
    mediaUrl: result.mediaUrl,
    expiresAt: result.expiresAt,
    ttlSec: result.ttlSec,
  });
}
