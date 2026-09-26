import { NextResponse } from "next/server";
import { z } from "zod";
import { auth, isAdminRole } from "@/lib/auth";
import { isRefundsV1Enabled } from "@/lib/feature-flags";
import { issueSpecialRefund } from "@/lib/refunds";

const schema = z.object({ reason: z.string().max(2000) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isRefundsV1Enabled()) {
    return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
  }
  const session = await auth();
  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Noto'g'ri ma'lumot" }, { status: 400 });

  const { id } = await params;
  const result = await issueSpecialRefund({
    purchaseId: id,
    actorUserId: session.user.id,
    actorRole: session.user.role,
    reason: parsed.data.reason,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.message, code: result.code }, { status: result.status });
  }
  return NextResponse.json({
    refundId: result.refundId,
    amount: result.amount,
    progressPercent: result.progressPercent,
  });
}
