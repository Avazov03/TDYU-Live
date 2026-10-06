import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isRefundsV1Enabled } from "@/lib/feature-flags";
import { requestBeforeStartRefund } from "@/lib/refunds";
import { entityIdSchema } from "@/lib/entity-id";

const schema = z.object({ purchaseId: entityIdSchema });

export async function POST(req: Request) {
  if (!isRefundsV1Enabled()) {
    return NextResponse.json({ error: "Qaytarish yopiq" }, { status: 404 });
  }
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "student") {
    return NextResponse.json({ error: "Ruxsat yo‘q" }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Noto‘g‘ri so‘rov" }, { status: 400 });
  const result = await requestBeforeStartRefund({
    purchaseId: parsed.data.purchaseId,
    userId: session.user.id,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.message, code: result.code }, { status: result.status });
  }
  return NextResponse.json({ ok: true, refundId: result.refundId, amount: result.amount });
}
