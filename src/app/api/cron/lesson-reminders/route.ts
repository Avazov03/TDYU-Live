import { NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { sendCourseStartReminders, sendUpcomingLessonReminders } from "@/lib/lesson-reminders";
import { closeStaleLobbies } from "@/lib/stale-lobby";

export const dynamic = "force-dynamic";

/**
 * Ixtiyoriy cron: GET /api/cron/lesson-reminders
 * Header: Authorization: Bearer $CRON_SECRET (yoki ?secret=)
 */
export async function GET(req: Request) {
  const denied = cronAuthError(req);
  if (denied) return denied;

  const created = await sendUpcomingLessonReminders();
  const courseStarts = await sendCourseStartReminders();
  const staleLobbiesClosed = await closeStaleLobbies();
  return NextResponse.json({ ok: true, created, courseStarts, staleLobbiesClosed });
}
