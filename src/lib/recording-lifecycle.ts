/**
 * Phase 8 Recording Wave 1 — lifecycle + authorization helpers.
 *
 * State machine (Recording.status):
 *   processing → ready → teacher_review → published
 *   processing → failed
 *
 * Students see playback only when status === published (+ Enrollment).
 * READY clock (24h auto-publish) starts at readyAt, not live end.
 */

import type { RecordingStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isRecordingReviewV1Enabled } from "@/lib/feature-flags";
import { writeAuditLog } from "@/lib/audit-log";
import { notifyCourseStudents } from "@/lib/notify";

export const RECORDING_REVIEW_HOURS = 24;
export const RECORDING_REVIEW_MS = RECORDING_REVIEW_HOURS * 60 * 60 * 1000;

const REVIEWABLE: RecordingStatus[] = ["ready", "teacher_review"];
const STUDENT_PLAYABLE: RecordingStatus[] = ["published"];

export function isStudentPlayableStatus(status: RecordingStatus | string): boolean {
  return STUDENT_PLAYABLE.includes(status as RecordingStatus);
}

export function isTeacherReviewableStatus(status: RecordingStatus | string): boolean {
  return REVIEWABLE.includes(status as RecordingStatus) || status === "published";
}

export function reviewDeadlineFromReadyAt(readyAt: Date): Date {
  return new Date(readyAt.getTime() + RECORDING_REVIEW_MS);
}

/** Pure: may student play this recording row? */
export function studentMayPlayRecording(input: {
  flagOn: boolean;
  recordingStatus: RecordingStatus | string | null | undefined;
}): boolean {
  if (!input.flagOn) return true; // legacy path decided elsewhere
  if (!input.recordingStatus) return false;
  return isStudentPlayableStatus(input.recordingStatus);
}

/** Pure: may teacher preview (ready / review / published)? */
export function teacherMayPreviewRecording(input: {
  flagOn: boolean;
  recordingStatus: RecordingStatus | string | null | undefined;
}): boolean {
  if (!input.flagOn) return true;
  if (!input.recordingStatus) return false;
  return isTeacherReviewableStatus(input.recordingStatus);
}

export function canPublishRecordingStatus(status: RecordingStatus | string): boolean {
  return status === "ready" || status === "teacher_review";
}

/**
 * After Live end: start recording lifecycle if material exists.
 * Local file → teacher_review (READY for review) immediately.
 * Real Mux VOD id → teacher_review.
 * Real Mux live stream without VOD yet → processing.
 * Never publishes. Never notifies students of VOD readiness.
 */
export async function startRecordingAfterLiveEnd(input: {
  lessonId: string;
  liveSessionId?: string | null;
  recordingUrl?: string | null;
  /** Real Mux VOD playback id (not live, not demo). */
  muxVodPlaybackId?: string | null;
  /** True when a real Mux live stream was used and VOD may still be processing. */
  awaitingMuxVod?: boolean;
  now?: Date;
}): Promise<{
  recording: Awaited<ReturnType<typeof prisma.recording.create>> | null;
  lessonStatus: "ended" | "recording_processing" | "teacher_review" | "published";
  created: boolean;
}> {
  const now = input.now ?? new Date();
  const hasLocal = Boolean(input.recordingUrl);
  const muxId =
    input.muxVodPlaybackId && !input.muxVodPlaybackId.startsWith("demo_")
      ? input.muxVodPlaybackId
      : null;
  const awaitingMux = Boolean(input.awaitingMuxVod) && !hasLocal && !muxId;

  if (!hasLocal && !muxId && !awaitingMux) {
    await prisma.lesson.update({
      where: { id: input.lessonId },
      data: {
        status: "ended",
        ...(input.recordingUrl ? { recordingUrl: input.recordingUrl } : {}),
      },
    });
    return { recording: null, lessonStatus: "ended", created: false };
  }

  const goReady = hasLocal || Boolean(muxId);
  const status: RecordingStatus = goReady ? "teacher_review" : "processing";
  const readyAt = goReady ? now : null;
  const reviewDeadlineAt = goReady ? reviewDeadlineFromReadyAt(now) : null;

  const existing = await prisma.recording.findFirst({
    where: {
      lessonId: input.lessonId,
      ...(input.liveSessionId ? { liveSessionId: input.liveSessionId } : {}),
      status: { in: ["not_started", "processing", "ready", "teacher_review", "published"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing?.status === "published") {
    await prisma.lesson.update({
      where: { id: input.lessonId },
      data: { status: "published" },
    });
    return { recording: existing, lessonStatus: "published", created: false };
  }

  let recording;
  let created = false;
  if (existing && existing.status !== "failed" && existing.status !== "hidden") {
    recording = await prisma.recording.update({
      where: { id: existing.id },
      data: {
        status:
          existing.status === "ready" || existing.status === "teacher_review"
            ? existing.status
            : status,
        storageKey: input.recordingUrl ?? existing.storageKey,
        muxPlaybackId: muxId ?? existing.muxPlaybackId,
        readyAt: existing.readyAt ?? readyAt,
        reviewDeadlineAt: existing.reviewDeadlineAt ?? reviewDeadlineAt,
        liveSessionId: input.liveSessionId ?? existing.liveSessionId,
      },
    });
  } else {
    recording = await prisma.recording.create({
      data: {
        lessonId: input.lessonId,
        liveSessionId: input.liveSessionId ?? null,
        status,
        storageKey: input.recordingUrl ?? null,
        muxPlaybackId: muxId,
        readyAt,
        reviewDeadlineAt,
      },
    });
    created = true;
  }

  const lessonStatus = goReady ? ("teacher_review" as const) : ("recording_processing" as const);

  await prisma.lesson.update({
    where: { id: input.lessonId },
    data: {
      status: lessonStatus,
      ...(input.recordingUrl ? { recordingUrl: input.recordingUrl } : {}),
      ...(muxId ? { muxVodPlaybackId: muxId } : {}),
    },
  });

  return { recording, lessonStatus, created };
}

/**
 * Mux / processing finished → READY (stored as teacher_review for review UX).
 * Idempotent. Does not publish. Does not notify students.
 */
export async function markRecordingReady(input: {
  lessonId: string;
  muxPlaybackId?: string | null;
  storageKey?: string | null;
  durationSeconds?: number | null;
  now?: Date;
}): Promise<{ recording: Awaited<ReturnType<typeof prisma.recording.findFirst>>; advanced: boolean }> {
  const now = input.now ?? new Date();

  let recording = await prisma.recording.findFirst({
    where: {
      lessonId: input.lessonId,
      status: { in: ["not_started", "processing", "ready", "teacher_review", "published", "failed"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!recording) {
    recording = await prisma.recording.create({
      data: {
        lessonId: input.lessonId,
        status: "teacher_review",
        muxPlaybackId: input.muxPlaybackId ?? null,
        storageKey: input.storageKey ?? null,
        durationSeconds: input.durationSeconds ?? null,
        readyAt: now,
        reviewDeadlineAt: reviewDeadlineFromReadyAt(now),
      },
    });
    await prisma.lesson.update({
      where: { id: input.lessonId },
      data: {
        status: "teacher_review",
        ...(input.muxPlaybackId ? { muxVodPlaybackId: input.muxPlaybackId } : {}),
        ...(input.storageKey ? { recordingUrl: input.storageKey } : {}),
      },
    });
    return { recording, advanced: true };
  }

  if (recording.status === "published") {
    return { recording, advanced: false };
  }
  if (recording.status === "ready" || recording.status === "teacher_review") {
    // Idempotent refresh of mux id / storage only
    const updated = await prisma.recording.update({
      where: { id: recording.id },
      data: {
        muxPlaybackId: input.muxPlaybackId ?? recording.muxPlaybackId,
        storageKey: input.storageKey ?? recording.storageKey,
        durationSeconds: input.durationSeconds ?? recording.durationSeconds,
        readyAt: recording.readyAt ?? now,
        reviewDeadlineAt: recording.reviewDeadlineAt ?? reviewDeadlineFromReadyAt(recording.readyAt ?? now),
      },
    });
    if (input.muxPlaybackId) {
      await prisma.lesson.update({
        where: { id: input.lessonId },
        data: { muxVodPlaybackId: input.muxPlaybackId },
      });
    }
    return { recording: updated, advanced: false };
  }

  if (recording.status === "failed" || recording.status === "hidden") {
    return { recording, advanced: false };
  }

  const readyAt = now;
  const updated = await prisma.recording.update({
    where: { id: recording.id },
    data: {
      status: "teacher_review",
      muxPlaybackId: input.muxPlaybackId ?? recording.muxPlaybackId,
      storageKey: input.storageKey ?? recording.storageKey,
      durationSeconds: input.durationSeconds ?? recording.durationSeconds,
      readyAt,
      reviewDeadlineAt: reviewDeadlineFromReadyAt(readyAt),
      failureReason: null,
    },
  });

  await prisma.lesson.update({
    where: { id: input.lessonId },
    data: {
      status: "teacher_review",
      ...(input.muxPlaybackId ? { muxVodPlaybackId: input.muxPlaybackId } : {}),
      ...(input.storageKey ? { recordingUrl: input.storageKey } : {}),
    },
  });

  return { recording: updated, advanced: true };
}

export async function failRecording(input: {
  lessonId: string;
  reason: string;
  source?: string;
}): Promise<void> {
  const recording = await prisma.recording.findFirst({
    where: {
      lessonId: input.lessonId,
      status: { in: ["not_started", "processing", "ready", "teacher_review"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (recording) {
    await prisma.recording.update({
      where: { id: recording.id },
      data: { status: "failed", failureReason: input.reason },
    });
  }
  // Lesson stays ended / processing — do not publish.
  const lesson = await prisma.lesson.findUnique({ where: { id: input.lessonId } });
  if (lesson && lesson.status !== "published" && lesson.status !== "cancelled") {
    await prisma.lesson.update({
      where: { id: input.lessonId },
      data: { status: "ended" },
    });
  }

  const existingIncident = await prisma.incident.findFirst({
    where: {
      relatedType: "recording",
      relatedId: recording?.id ?? input.lessonId,
      status: "open",
      title: "Recording processing failed",
    },
  });
  if (!existingIncident) {
    await prisma.incident.create({
      data: {
        level: "high",
        title: "Recording processing failed",
        detail: input.reason,
        source: input.source ?? "recording-lifecycle",
        relatedType: "recording",
        relatedId: recording?.id ?? input.lessonId,
      },
    });
  }
}

/**
 * Teacher (or auto-publish) → PUBLISHED.
 * Idempotent if already published.
 */
export async function publishRecording(input: {
  lessonId: string;
  actorId?: string | null;
  autoPublished?: boolean;
  now?: Date;
}): Promise<{
  ok: true;
  recording: NonNullable<Awaited<ReturnType<typeof prisma.recording.findFirst>>>;
  already: boolean;
} | { ok: false; code: string }> {
  const now = input.now ?? new Date();
  const recording = await prisma.recording.findFirst({
    where: { lessonId: input.lessonId },
    orderBy: { createdAt: "desc" },
  });
  if (!recording) return { ok: false, code: "NO_RECORDING" };

  if (recording.status === "published") {
    return { ok: true, recording, already: true };
  }
  if (!canPublishRecordingStatus(recording.status)) {
    if (recording.status === "failed" || recording.status === "hidden") {
      return { ok: false, code: "FAILED" };
    }
    return { ok: false, code: "NOT_READY" };
  }

  const updated = await prisma.recording.update({
    where: { id: recording.id },
    data: {
      status: "published",
      publishedAt: now,
      autoPublished: Boolean(input.autoPublished),
    },
  });

  const lesson = await prisma.lesson.update({
    where: { id: input.lessonId },
    data: {
      status: "published",
      ...(updated.storageKey ? { recordingUrl: updated.storageKey } : {}),
      ...(updated.muxPlaybackId ? { muxVodPlaybackId: updated.muxPlaybackId } : {}),
    },
    include: { course: true },
  });

  if (input.actorId) {
    await writeAuditLog({
      actorId: input.actorId,
      action: input.autoPublished ? "recording.auto_publish" : "recording.publish",
      entityType: "Recording",
      entityId: updated.id,
      metadata: { lessonId: input.lessonId, autoPublished: Boolean(input.autoPublished) },
    });
  }

  await notifyCourseStudents(
    lesson.courseId,
    {
      type: "recording_published",
      titleUz: "Yozuv chop etildi",
      messageUz: `${lesson.course.titleUz}: ${lesson.titleUz}`,
      relatedId: lesson.id,
    },
    "t1",
  );

  return { ok: true, recording: updated, already: false };
}

/** Cron: publish reviewable recordings past reviewDeadlineAt. */
export async function autoPublishDueRecordings(now = new Date()): Promise<number> {
  if (!isRecordingReviewV1Enabled()) return 0;

  const due = await prisma.recording.findMany({
    where: {
      status: { in: ["ready", "teacher_review"] },
      reviewDeadlineAt: { lte: now },
      publishedAt: null,
    },
    take: 50,
  });

  let count = 0;
  for (const row of due) {
    const res = await publishRecording({
      lessonId: row.lessonId,
      actorId: null,
      autoPublished: true,
      now,
    });
    if (res.ok && !res.already) count += 1;
  }
  return count;
}

export async function getLatestRecordingForLesson(lessonId: string) {
  return prisma.recording.findFirst({
    where: { lessonId },
    orderBy: { createdAt: "desc" },
  });
}
