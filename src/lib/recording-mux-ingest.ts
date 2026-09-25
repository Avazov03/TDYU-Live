/**
 * Phase 8.1 — signed Mux VOD ingest for durable recording files.
 *
 * start:    storage file → Mux direct upload (asset created SIGNED-only)
 * finalize: asset ready → signed playback id → Recording (teacher_review, never published)
 *
 * Idempotency ledger: AuditLog rows keyed by a stable passthrough per (lesson, storageKey).
 * Never deletes source media, Mux assets or playback IDs. Never overwrites Lesson.muxVodPlaybackId.
 */

import { createHash } from "crypto";
import { stat } from "fs/promises";
import type { RecordingStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log";
import {
  createMuxDirectUpload,
  createMuxSignedPlaybackId,
  getMuxAsset,
  getMuxUpload,
  isMuxConfigured,
  putFileToMuxUpload,
  type MuxAssetDetail,
} from "@/lib/mux";
import { isMuxSigningConfigured } from "@/lib/mux-signed-playback";
import { reviewDeadlineFromReadyAt } from "@/lib/recording-lifecycle";
import {
  parseRecordingStorageKey,
  recordingContentType,
  resolveStorageKeyToPath,
  sha256File,
} from "@/lib/recording-storage";

export const MUX_INGEST_VERSION = "phase8.1-v1";

export type IngestOrigin = "live" | "legacy_recovery";

export function ingestPassthrough(lessonId: string, storageKey: string): string {
  const h = createHash("sha256").update(storageKey).digest("hex").slice(0, 16);
  return `lexify:rec:v1:${lessonId}:${h}`;
}

export function parseIngestPassthrough(p: string | null | undefined): { lessonId: string } | null {
  const m = /^lexify:rec:v1:([0-9a-f-]{36}):[0-9a-f]{16}$/.exec(p ?? "");
  return m ? { lessonId: m[1] } : null;
}

/** Pure: may this recording row receive a Mux ingest? */
export function canIngestRecording(
  rec: { status: RecordingStatus | string; muxPlaybackId: string | null } | null,
): { ok: true } | { ok: false; code: string } {
  if (!rec) return { ok: true };
  if (rec.muxPlaybackId) return { ok: false, code: "ALREADY_HAS_MUX_PLAYBACK" };
  if (rec.status === "hidden") return { ok: false, code: "HIDDEN" };
  return { ok: true };
}

/** Pure: reuse a previous upload from the ledger, or start a new one. */
export function decideUploadReuse(
  prior: { status: string; assetId: string | null } | null,
): "NEW_UPLOAD" | "REUSE_ASSET" | "WAIT_UPLOAD" {
  if (!prior) return "NEW_UPLOAD";
  if (prior.assetId) return "REUSE_ASSET";
  if (prior.status === "waiting" || prior.status === "asset_created") return "WAIT_UPLOAD";
  return "NEW_UPLOAD"; // errored / cancelled / timed_out
}

export type AssetDecision =
  | { action: "PENDING" }
  | { action: "FAIL"; reason: string }
  | { action: "BLOCK"; reason: string }
  | { action: "USE_SIGNED"; playbackId: string }
  | { action: "CREATE_SIGNED" };

/** Pure: what to do with a Mux asset for this ingest. Public VOD playback is never accepted. */
export function decideAssetPlayback(asset: MuxAssetDetail | null, expectedPassthrough: string): AssetDecision {
  if (!asset) return { action: "FAIL", reason: "asset not found" };
  if (asset.passthrough !== expectedPassthrough) {
    return { action: "BLOCK", reason: "asset passthrough does not match this lesson/storage key" };
  }
  if (asset.status === "errored") {
    return { action: "FAIL", reason: asset.errorMessages.join("; ") || "Mux asset errored" };
  }
  if (asset.status !== "ready") return { action: "PENDING" };
  if (asset.playbackIds.some((p) => p.policy === "public")) {
    return { action: "BLOCK", reason: "asset has a PUBLIC playback id" };
  }
  const signed = asset.playbackIds.find((p) => p.policy === "signed");
  return signed ? { action: "USE_SIGNED", playbackId: signed.id } : { action: "CREATE_SIGNED" };
}

type LedgerEntry = {
  uploadId: string;
  passthrough: string;
  storageKey: string;
  sha256: string | null;
  origin: IngestOrigin;
};

async function findLedgerUpload(lessonId: string, passthrough: string): Promise<LedgerEntry | null> {
  const rows = await prisma.auditLog.findMany({
    where: { action: "recording.mux_ingest_started", entityType: "Lesson", entityId: lessonId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  for (const r of rows) {
    try {
      const m = JSON.parse(r.metadata ?? "{}") as Partial<LedgerEntry>;
      if (m.passthrough === passthrough && m.uploadId) {
        return {
          uploadId: m.uploadId,
          passthrough,
          storageKey: m.storageKey ?? "",
          sha256: m.sha256 ?? null,
          origin: m.origin === "legacy_recovery" ? "legacy_recovery" : "live",
        };
      }
    } catch {
      /* ignore malformed */
    }
  }
  return null;
}

async function recordIngestFailure(input: {
  lessonId: string;
  recordingId: string | null;
  reason: string;
  markFailed: boolean;
}) {
  if (input.recordingId && input.markFailed) {
    await prisma.recording.update({
      where: { id: input.recordingId },
      data: { status: "failed", failureReason: input.reason },
    });
  }
  await writeAuditLog({
    action: "recording.mux_ingest_failed",
    entityType: "Lesson",
    entityId: input.lessonId,
    metadata: { recordingId: input.recordingId, reason: input.reason, version: MUX_INGEST_VERSION },
  });
  const relatedId = input.recordingId ?? input.lessonId;
  const open = await prisma.incident.findFirst({
    where: { relatedType: "recording", relatedId, status: "open", title: "Recording Mux ingest failed" },
  });
  if (!open) {
    await prisma.incident.create({
      data: {
        level: "high",
        title: "Recording Mux ingest failed",
        detail: input.reason,
        source: "recording-mux-ingest",
        relatedType: "recording",
        relatedId,
      },
    });
  }
}

export type StartIngestResult =
  | { state: "SKIPPED"; code: string }
  | { state: "BLOCKED"; code: string }
  | { state: "UPLOADED" | "REUSED"; uploadId: string; passthrough: string }
  | { state: "FAILED"; reason: string };

/**
 * Upload the durable file to Mux (signed-only asset). Safe to call repeatedly.
 */
export async function startRecordingMuxIngest(input: {
  lessonId: string;
  storageKey: string;
  expectedSha256?: string | null;
  actorId?: string | null;
  origin?: IngestOrigin;
}): Promise<StartIngestResult> {
  if (!isMuxConfigured()) return { state: "BLOCKED", code: "MUX_API_CREDENTIALS_MISSING" };
  if (!isMuxSigningConfigured()) return { state: "BLOCKED", code: "MUX_SIGNING_KEY_MISSING" };

  const lesson = await prisma.lesson.findUnique({ where: { id: input.lessonId } });
  if (!lesson) return { state: "BLOCKED", code: "LESSON_NOT_FOUND" };
  const parsed = parseRecordingStorageKey(input.storageKey);
  if (!parsed || parsed.kind !== "durable" || parsed.lessonId !== lesson.id || parsed.courseId !== lesson.courseId) {
    return { state: "BLOCKED", code: "STORAGE_KEY_NOT_DURABLE_FOR_LESSON" };
  }

  const recording = await prisma.recording.findFirst({
    where: { lessonId: lesson.id },
    orderBy: { createdAt: "desc" },
  });
  const gate = canIngestRecording(recording);
  if (!gate.ok) return { state: "SKIPPED", code: gate.code };
  if (recording?.storageKey && recording.storageKey !== input.storageKey) {
    return { state: "BLOCKED", code: "RECORDING_STORAGE_KEY_MISMATCH" };
  }

  const passthrough = ingestPassthrough(lesson.id, input.storageKey);
  const prior = await findLedgerUpload(lesson.id, passthrough);
  if (prior) {
    const status = await getMuxUpload(prior.uploadId);
    const decision = decideUploadReuse(status ? { status: status.status, assetId: status.assetId } : null);
    if (decision !== "NEW_UPLOAD") {
      return { state: "REUSED", uploadId: prior.uploadId, passthrough };
    }
  }

  const { absPath, container } = resolveStorageKeyToPath(input.storageKey);
  let size: number;
  try {
    size = (await stat(absPath)).size;
  } catch {
    await recordIngestFailure({
      lessonId: lesson.id,
      recordingId: recording?.id ?? null,
      reason: "source file missing in persistent storage",
      markFailed: false,
    });
    return { state: "FAILED", reason: "SOURCE_MISSING" };
  }
  const sha256 = await sha256File(absPath);
  if (input.expectedSha256 && input.expectedSha256 !== sha256) {
    return { state: "BLOCKED", code: "CHECKSUM_MISMATCH" };
  }

  try {
    const upload = await createMuxDirectUpload({ passthrough });
    // Ledger must persist before any bytes reach Mux (no asset exists until the PUT).
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: "recording.mux_ingest_started",
        entityType: "Lesson",
        entityId: lesson.id,
        metadata: JSON.stringify({
          uploadId: upload.uploadId,
          passthrough,
          storageKey: input.storageKey,
          sha256,
          size,
          recordingId: recording?.id ?? null,
          origin: input.origin ?? "live",
          version: MUX_INGEST_VERSION,
        }),
      },
    });
    await putFileToMuxUpload({ url: upload.url, absPath, size, contentType: recordingContentType(container) });
    return { state: "UPLOADED", uploadId: upload.uploadId, passthrough };
  } catch (err) {
    const reason = err instanceof Error ? err.message.slice(0, 300) : "upload failed";
    await recordIngestFailure({ lessonId: lesson.id, recordingId: recording?.id ?? null, reason, markFailed: false });
    return { state: "FAILED", reason };
  }
}

/** Webhook entry: map an uploaded asset back to its ledger entry via passthrough only. */
export async function finalizeIngestByPassthrough(passthrough: string): Promise<FinalizeIngestResult | null> {
  const parsed = parseIngestPassthrough(passthrough);
  if (!parsed) return null;
  const rows = await prisma.auditLog.findMany({
    where: { action: "recording.mux_ingest_started", entityType: "Lesson", entityId: parsed.lessonId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  for (const r of rows) {
    try {
      const m = JSON.parse(r.metadata ?? "{}") as { passthrough?: string; storageKey?: string };
      if (m.passthrough === passthrough && m.storageKey) {
        return finalizeRecordingMuxIngest({ lessonId: parsed.lessonId, storageKey: m.storageKey });
      }
    } catch {
      /* ignore malformed */
    }
  }
  return null;
}

export type FinalizeIngestResult =
  | { state: "PENDING" }
  | { state: "BLOCKED"; code: string }
  | { state: "FAILED"; reason: string }
  | { state: "READY"; recordingId: string; playbackId: string; assetId: string; created: boolean };

/**
 * Asset ready → signed playback → Recording (teacher_review). Idempotent.
 * Legacy recovery: reviewDeadlineAt stays null so the 24h auto-publish cron cannot publish it.
 */
export async function finalizeRecordingMuxIngest(input: {
  lessonId: string;
  storageKey: string;
  origin?: IngestOrigin;
  actorId?: string | null;
  now?: Date;
}): Promise<FinalizeIngestResult> {
  const passthrough = ingestPassthrough(input.lessonId, input.storageKey);
  const ledger = await findLedgerUpload(input.lessonId, passthrough);
  if (!ledger) return { state: "BLOCKED", code: "NO_INGEST_STARTED" };
  const origin = input.origin ?? ledger.origin;

  const upload = await getMuxUpload(ledger.uploadId);
  if (!upload) return { state: "FAILED", reason: "upload not found" };
  if (upload.status === "errored" || upload.status === "cancelled" || upload.status === "timed_out") {
    return { state: "FAILED", reason: `upload ${upload.status}` };
  }
  if (!upload.assetId) return { state: "PENDING" };

  const asset = await getMuxAsset(upload.assetId);
  const decision = decideAssetPlayback(asset, passthrough);
  const existing = await prisma.recording.findFirst({
    where: { lessonId: input.lessonId },
    orderBy: { createdAt: "desc" },
  });

  if (decision.action === "PENDING") return { state: "PENDING" };
  if (decision.action === "BLOCK") return { state: "BLOCKED", code: decision.reason };
  if (decision.action === "FAIL") {
    await recordIngestFailure({
      lessonId: input.lessonId,
      recordingId: existing?.id ?? null,
      reason: decision.reason,
      markFailed: Boolean(existing && existing.status !== "published"),
    });
    return { state: "FAILED", reason: decision.reason };
  }

  let playbackId: string;
  if (decision.action === "CREATE_SIGNED") {
    playbackId = await createMuxSignedPlaybackId(upload.assetId);
    const verify = await getMuxAsset(upload.assetId);
    if (!verify?.playbackIds.some((p) => p.id === playbackId && p.policy === "signed")) {
      return { state: "BLOCKED", code: "SIGNED_PLAYBACK_NOT_VERIFIED" };
    }
  } else {
    playbackId = decision.playbackId;
  }

  if (existing?.muxPlaybackId && existing.muxPlaybackId !== playbackId) {
    return { state: "BLOCKED", code: "RECORDING_HAS_DIFFERENT_MUX_PLAYBACK" };
  }

  const now = input.now ?? new Date();
  let recordingId: string;
  let created = false;
  if (existing) {
    const toReview = existing.status === "processing" || existing.status === "not_started" || existing.status === "failed";
    const updated = await prisma.recording.update({
      where: { id: existing.id },
      data: {
        muxPlaybackId: playbackId,
        storageKey: existing.storageKey ?? input.storageKey,
        durationSeconds: existing.durationSeconds ?? asset?.durationSeconds ?? null,
        ...(toReview
          ? {
              status: "teacher_review",
              readyAt: existing.readyAt ?? now,
              reviewDeadlineAt:
                origin === "live" ? existing.reviewDeadlineAt ?? reviewDeadlineFromReadyAt(now) : null,
              failureReason: null,
            }
          : {}),
      },
    });
    recordingId = updated.id;
  } else {
    const row = await prisma.recording.create({
      data: {
        lessonId: input.lessonId,
        status: "teacher_review",
        storageKey: input.storageKey,
        muxPlaybackId: playbackId,
        durationSeconds: asset?.durationSeconds ?? null,
        readyAt: now,
        reviewDeadlineAt: origin === "live" ? reviewDeadlineFromReadyAt(now) : null,
      },
    });
    recordingId = row.id;
    created = true;
  }

  const lesson = await prisma.lesson.findUnique({ where: { id: input.lessonId } });
  if (lesson?.status === "recording_processing") {
    await prisma.lesson.update({ where: { id: lesson.id }, data: { status: "teacher_review" } });
  }

  await writeAuditLog({
    actorId: input.actorId ?? null,
    action: "recording.signed_playback_created",
    entityType: "Recording",
    entityId: recordingId,
    metadata: {
      lessonId: input.lessonId,
      assetId: upload.assetId,
      playbackId,
      policy: "signed",
      origin,
      created,
      version: MUX_INGEST_VERSION,
    },
  });

  return { state: "READY", recordingId, playbackId, assetId: upload.assetId, created };
}
