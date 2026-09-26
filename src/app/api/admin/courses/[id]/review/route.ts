import { NextResponse } from "next/server";
import { z } from "zod";
import { auth, isAdminRole } from "@/lib/auth";
import { isCourseReviewV1Enabled } from "@/lib/feature-flags";
import { applyCourseReviewAction } from "@/lib/course-review";

const schema = z.object({
  action: z.enum(["start_review", "request_changes", "reject", "approve", "publish"]),
  reason: z.string().trim().max(2000).optional(),
  listPrice: z.number().int().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isCourseReviewV1Enabled()) {
    return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
  }
  const session = await auth();
  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Noto'g'ri ma'lumot" }, { status: 400 });

  const { id } = await params;
  const result = await applyCourseReviewAction({
    courseId: id,
    actorUserId: session.user.id,
    actorRole: session.user.role,
    action: parsed.data.action,
    reason: parsed.data.reason,
    listPrice: parsed.data.listPrice,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.message, code: result.code }, { status: result.status });
  }
  return NextResponse.json({ lifecycleStatus: result.to });
}
