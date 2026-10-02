import { NextResponse } from "next/server";
import { auth, isAdminRole } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Admin-only: throws on purpose so the onRequestError → Telegram alert chain can be verified end to end. */
export async function POST(_req: Request) {
  const session = await auth();
  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }
  if (!rateLimit(`ops-test-alert:${session.user.id}`, 3, 10 * 60_000)) {
    return NextResponse.json({ error: "Juda ko'p urinish" }, { status: 429 });
  }
  throw new Error("Lexify ops alert test (admin requested)");
}
