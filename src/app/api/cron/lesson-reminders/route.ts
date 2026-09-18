import { NextResponse } from "next/server";
import { sendUpcomingLessonReminders } from "@/lib/lesson-reminders";

export const dynamic = "force-dynamic";

/**
 * Ixtiyoriy cron: GET /api/cron/lesson-reminders
 * Header: Authorization: Bearer $CRON_SECRET (yoki ?secret=)
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET yo‘q" }, { status: 503 });
  }

  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const url = new URL(req.url);
  const querySecret = url.searchParams.get("secret") ?? "";
  if (bearer !== secret && querySecret !== secret) {
    return NextResponse.json({ error: "Ruxsat yo‘q" }, { status: 401 });
  }

  const created = await sendUpcomingLessonReminders();
  return NextResponse.json({ ok: true, created });
}
