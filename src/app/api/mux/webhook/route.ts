import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyCourseStudents } from "@/lib/notify";
import { isRecordingReviewV1Enabled } from "@/lib/feature-flags";
import { verifyMuxWebhookSignature } from "@/lib/mux-webhook";
import { failRecording, markRecordingReady } from "@/lib/recording-lifecycle";
import { finalizeIngestByPassthrough, parseIngestPassthrough } from "@/lib/recording-mux-ingest";

type MuxEvent = {
  type?: string;
  id?: string;
  data?: {
    live_stream_id?: string;
    playback_ids?: { id: string }[];
    id?: string;
    passthrough?: string;
    errors?: { messages?: string[] };
  };
};

export async function POST(req: Request) {
  const rawBody = await req.text();
  const secret = process.env.MUX_WEBHOOK_SECRET?.trim() ?? "";
  const e2eFixture =
    process.env.E2E_MUX_WEBHOOK_FIXTURE === "1" &&
    req.headers.get("x-e2e-mux-fixture") === "1" &&
    process.env.NODE_ENV !== "production";

  if (secret) {
    const verified = verifyMuxWebhookSignature({
      rawBody,
      signatureHeader: req.headers.get("mux-signature"),
      secret,
    });
    if (!verified.ok) {
      return NextResponse.json({ error: "Invalid signature", code: verified.code }, { status: 401 });
    }
  } else if (!e2eFixture) {
    // Unsigned webhooks are rejected when Wave 1 is on; legacy unsigned only if flag off + no secret.
    if (isRecordingReviewV1Enabled()) {
      return NextResponse.json({ error: "MUX_WEBHOOK_SECRET required" }, { status: 503 });
    }
  }

  let event: MuxEvent;
  try {
    event = JSON.parse(rawBody) as MuxEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const liveStreamId = event.data?.live_stream_id;
  const playbackId = event.data?.playback_ids?.[0]?.id;

  // Phase 8.1 uploaded (non-live) assets: mapped only via our own passthrough ledger.
  if (
    !liveStreamId &&
    (event.type === "video.asset.ready" || event.type === "video.asset.errored") &&
    parseIngestPassthrough(event.data?.passthrough)
  ) {
    if (!secret) {
      return NextResponse.json({ error: "MUX_WEBHOOK_SECRET required" }, { status: 503 });
    }
    const result = await finalizeIngestByPassthrough(event.data!.passthrough!);
    return NextResponse.json({ ok: true, ingest: result?.state ?? "UNKNOWN_PASSTHROUGH" });
  }

  if (event.type === "video.asset.errored" && liveStreamId) {
    const lesson = await prisma.lesson.findFirst({ where: { muxLiveStreamId: liveStreamId } });
    if (lesson && isRecordingReviewV1Enabled()) {
      await failRecording({
        lessonId: lesson.id,
        reason: event.data?.errors?.messages?.join("; ") || "Mux asset errored",
        source: "mux.webhook",
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (event.type === "video.asset.ready" && liveStreamId && playbackId) {
    const lesson = await prisma.lesson.findFirst({
      where: { muxLiveStreamId: liveStreamId },
      include: { course: true },
    });
    if (!lesson) {
      return NextResponse.json({ ok: true, skipped: "unknown_stream" });
    }

    if (isRecordingReviewV1Enabled()) {
      // Map by known lesson.muxLiveStreamId only — never trust client lessonId.
      await markRecordingReady({
        lessonId: lesson.id,
        muxPlaybackId: playbackId,
      });
      // Students are notified only on teacher/auto publish — not here.
    } else {
      await prisma.lesson.update({
        where: { id: lesson.id },
        data: {
          status: "ended",
          muxVodPlaybackId: playbackId,
        },
      });
      await notifyCourseStudents(lesson.courseId, {
        type: "lesson_live",
        titleUz: "Yozuv tayyor",
        messageUz: `${lesson.course.titleUz}: ${lesson.titleUz}`,
        relatedId: lesson.id,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
