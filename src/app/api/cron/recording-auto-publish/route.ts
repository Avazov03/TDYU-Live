import { NextResponse } from "next/server";
import { autoPublishDueRecordings } from "@/lib/recording-lifecycle";
import { isRecordingReviewV1Enabled } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

/**
 * Cron: GET /api/cron/recording-auto-publish
 * Authorization: Bearer $CRON_SECRET (or ?secret=)
 * Auto-publishes READY/TEACHER_REVIEW past reviewDeadlineAt (24h from readyAt).
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

  if (!isRecordingReviewV1Enabled()) {
    return NextResponse.json({ ok: true, published: 0, skipped: "flag_off" });
  }

  const published = await autoPublishDueRecordings();
  return NextResponse.json({ ok: true, published });
}
