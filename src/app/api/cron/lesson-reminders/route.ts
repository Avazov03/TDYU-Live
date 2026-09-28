import { NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { sendUpcomingLessonReminders } from "@/lib/lesson-reminders";

export const dynamic = "force-dynamic";

/**
 * Ixtiyoriy cron: GET /api/cron/lesson-reminders
 * Header: Authorization: Bearer $CRON_SECRET (yoki ?secret=)
 */
export async function GET(req: Request) {
  const denied = cronAuthError(req);
  if (denied) return denied;

  const created = await sendUpcomingLessonReminders();
  return NextResponse.json({ ok: true, created });
}
