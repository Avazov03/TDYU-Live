import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isCourseCompletionV1Enabled } from "@/lib/feature-flags";
import { completeCourse } from "@/lib/course-completion";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isCourseCompletionV1Enabled()) {
    return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
  }
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }
  const { id } = await params;
  const result = await completeCourse({
    courseId: id,
    actorUserId: session.user.id,
    actorRole: session.user.role,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.message, code: result.code }, { status: result.status });
  }
  return NextResponse.json({ lifecycleStatus: "completed", completedSeats: result.completedSeats });
}
