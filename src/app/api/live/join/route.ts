import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { authorizeLiveJoin } from "@/lib/live-auth";
import { isLiveAttendanceV3Enabled, isLiveAvPolicyV2Enabled } from "@/lib/feature-flags";
import { openLiveAttendanceInterval } from "@/lib/live-attendance";

const bodySchema = z.object({
  lessonId: z.string().uuid().or(z.string().trim().min(1)),
});

/**
 * POST /api/live/join — authorize + short-lived join token (Wave 1).
 * Waiting presence ≠ attendance. Wave 3 opens AttendanceInterval only when phase=live.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHENTICATED", message: "Kirish kerak" } },
      { status: 401 },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID", message: "Noto'g'ri ma'lumot" } },
      { status: 400 },
    );
  }

  const result = await authorizeLiveJoin({
    userId: session.user.id,
    role: session.user.role,
    lessonId: parsed.data.lessonId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: { code: result.code, message: result.message } },
      { status: result.http },
    );
  }

  let attendance: { id: string; joinedAt: string; reused: boolean } | null = null;
  if (isLiveAttendanceV3Enabled()) {
    const opened = await openLiveAttendanceInterval({
      userId: session.user.id,
      lessonId: result.lessonId,
      liveSessionId: result.liveSessionId,
      moderator: result.moderator,
      phase: result.phase,
      liveSessionStatus: result.liveSessionStatus,
    });
    if (opened.ok) {
      attendance = {
        id: opened.interval.id,
        joinedAt: opened.interval.joinedAt.toISOString(),
        reused: opened.reused,
      };
    }
  }

  return NextResponse.json({
    ok: true,
    peerId: result.peerId,
    joinToken: result.joinToken,
    liveSessionId: result.liveSessionId,
    liveSessionStatus: result.liveSessionStatus,
    lessonStatus: result.lessonStatus,
    phase: result.phase,
    moderator: result.moderator,
    avPolicyV2: isLiveAvPolicyV2Enabled(),
    attendanceV3: isLiveAttendanceV3Enabled(),
    attendance,
  });
}
