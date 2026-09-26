import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isCourseReviewV1Enabled } from "@/lib/feature-flags";
import { applyCourseReviewAction } from "@/lib/course-review";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isCourseReviewV1Enabled()) {
    return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
  }
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }
  const { id } = await params;
  const result = await applyCourseReviewAction({
    courseId: id,
    actorUserId: session.user.id,
    actorRole: session.user.role,
    action: "submit",
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.message, code: result.code }, { status: result.status });
  }
  return NextResponse.json({ lifecycleStatus: result.to });
}
