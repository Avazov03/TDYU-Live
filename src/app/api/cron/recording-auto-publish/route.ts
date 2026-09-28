import { NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { autoPublishDueRecordings } from "@/lib/recording-lifecycle";
import { isRecordingReviewV1Enabled } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

/**
 * Cron: GET /api/cron/recording-auto-publish
 * Authorization: Bearer $CRON_SECRET (or ?secret=)
 * Auto-publishes READY/TEACHER_REVIEW past reviewDeadlineAt (24h from readyAt).
 */
export async function GET(req: Request) {
  const denied = cronAuthError(req);
  if (denied) return denied;

  if (!isRecordingReviewV1Enabled()) {
    return NextResponse.json({ ok: true, published: 0, skipped: "flag_off" });
  }

  const published = await autoPublishDueRecordings();
  return NextResponse.json({ ok: true, published });
}
