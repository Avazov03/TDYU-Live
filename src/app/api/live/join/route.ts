import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { authorizeLiveJoin } from "@/lib/live-auth";

const bodySchema = z.object({
  lessonId: z.string().uuid().or(z.string().trim().min(1)),
});

/**
 * POST /api/live/join — authorize + short-lived join token (Wave 1).
 * Does not mark attendance. Waiting presence ≠ attendance.
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

  return NextResponse.json({
    ok: true,
    peerId: result.peerId,
    joinToken: result.joinToken,
    liveSessionId: result.liveSessionId,
    liveSessionStatus: result.liveSessionStatus,
    lessonStatus: result.lessonStatus,
    phase: result.phase,
    moderator: result.moderator,
  });
}
