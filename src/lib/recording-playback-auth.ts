/**
 * Phase 8 Recording Wave 2 — authorize recording playback then issue signed token.
 *
 * Never accepts client-supplied playbackId for signing.
 */

import { prisma } from "@/lib/prisma";
import { getLessonAccess } from "@/lib/access";
import { isAdminRole, isTeacherRole } from "@/lib/roles";
import {
  isRecordingReviewV1Enabled,
  isRecordingSignedPlaybackV1Enabled,
} from "@/lib/feature-flags";
import {
  getLatestRecordingForLesson,
  studentMayPlayRecording,
  teacherMayPreviewRecording,
} from "@/lib/recording-lifecycle";
import {
  isMuxSigningConfigured,
  muxSignedPlayerUrl,
  signFixturePlaybackToken,
  signMuxPlaybackToken,
  MUX_PLAYBACK_TOKEN_TTL_SEC,
} from "@/lib/mux-signed-playback";
import { writeAuditLog } from "@/lib/audit-log";

export type PlaybackAuthOk = {
  ok: true;
  recordingId: string;
  lessonId: string;
  courseId: string;
  playbackId: string | null;
  storageKey: string | null;
  role: "student" | "teacher" | "admin";
  published: boolean;
};

export type PlaybackAuthFail = {
  ok: false;
  status: number;
  code: string;
};

/**
 * Authorize playback for a recording identified by recordingId XOR lessonId.
 * Rejects any attempt to pass an arbitrary playbackId (callers must not forward one).
 */
export async function authorizeRecordingPlayback(input: {
  userId: string;
  userRole: string;
  recordingId?: string | null;
  lessonId?: string | null;
}): Promise<PlaybackAuthOk | PlaybackAuthFail> {
  if (input.recordingId && input.lessonId) {
    // Ambiguous — require one identifier
  }

  let recording: Awaited<ReturnType<typeof getLatestRecordingForLesson>> = null;
  let lessonId = input.lessonId?.trim() || "";

  if (input.recordingId?.trim()) {
    recording = await prisma.recording.findUnique({
      where: { id: input.recordingId.trim() },
    });
    if (!recording) return { ok: false, status: 404, code: "RECORDING_NOT_FOUND" };
    lessonId = recording.lessonId;
  } else if (lessonId) {
    recording = await getLatestRecordingForLesson(lessonId);
    if (!recording) return { ok: false, status: 404, code: "RECORDING_NOT_FOUND" };
  } else {
    return { ok: false, status: 400, code: "RECORDING_ID_REQUIRED" };
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: recording.lessonId },
    include: { course: { include: { teacher: true } } },
  });
  if (!lesson) return { ok: false, status: 404, code: "RECORDING_NOT_FOUND" };

  const isAdmin = isAdminRole(input.userRole);
  const isCourseTeacher =
    isTeacherRole(input.userRole) && lesson.course.teacher.userId === input.userId;

  if (isAdmin || isCourseTeacher) {
    const reviewV1 = isRecordingReviewV1Enabled();
    if (
      reviewV1 &&
      !teacherMayPreviewRecording({ flagOn: true, recordingStatus: recording.status })
    ) {
      return { ok: false, status: 403, code: "NOT_READY" };
    }
    return {
      ok: true,
      recordingId: recording.id,
      lessonId: lesson.id,
      courseId: lesson.courseId,
      playbackId: recording.muxPlaybackId,
      storageKey: recording.storageKey,
      role: isAdmin ? "admin" : "teacher",
      published: recording.status === "published",
    };
  }

  // Students
  const access = await getLessonAccess(input.userId, lesson.courseId, lesson.status);
  if (!access.ok) {
    return {
      ok: false,
      status: access.reason === "unauthenticated" ? 401 : 403,
      code:
        access.reason === "unauthenticated"
          ? "UNAUTHENTICATED"
          : access.reason === "expired"
            ? "NOT_ENROLLED"
            : access.reason === "no_subscription"
              ? "NOT_ENROLLED"
              : "RECORDING_ACCESS_DENIED",
    };
  }

  const reviewV1 = isRecordingReviewV1Enabled();
  if (reviewV1) {
    if (!studentMayPlayRecording({ flagOn: true, recordingStatus: recording.status })) {
      return { ok: false, status: 403, code: "NOT_PUBLISHED" };
    }
  } else if (recording.status !== "published" && !recording.muxPlaybackId && !recording.storageKey) {
    return { ok: false, status: 403, code: "NOT_PUBLISHED" };
  }

  return {
    ok: true,
    recordingId: recording.id,
    lessonId: lesson.id,
    courseId: lesson.courseId,
    playbackId: recording.muxPlaybackId,
    storageKey: recording.storageKey,
    role: "student",
    published: recording.status === "published",
  };
}

export async function issueRecordingPlaybackToken(input: {
  userId: string;
  userRole: string;
  recordingId?: string | null;
  lessonId?: string | null;
  /** Reject if client sends this — never sign arbitrary ids. */
  playbackIdFromClient?: string | null;
}): Promise<
  | {
      ok: true;
      recordingId: string;
      lessonId: string;
      expiresAt: string;
      ttlSec: number;
      mode: "mux" | "fixture" | "local";
      token: string | null;
      playerUrl: string | null;
      mediaUrl: string | null;
    }
  | PlaybackAuthFail
> {
  if (input.playbackIdFromClient) {
    return { ok: false, status: 400, code: "PLAYBACK_ID_NOT_ACCEPTED" };
  }

  if (!isRecordingSignedPlaybackV1Enabled()) {
    return { ok: false, status: 503, code: "FEATURE_DISABLED" };
  }

  const authz = await authorizeRecordingPlayback(input);
  if (!authz.ok) return authz;

  // Local file path — already gated by /api/media/recording; no Mux token.
  if (authz.storageKey && !authz.playbackId) {
    await writeAuditLog({
      actorId: input.userId,
      action: "recording.playback_token",
      entityType: "Recording",
      entityId: authz.recordingId,
      metadata: { mode: "local", role: authz.role },
    });
    return {
      ok: true,
      recordingId: authz.recordingId,
      lessonId: authz.lessonId,
      expiresAt: new Date(Date.now() + MUX_PLAYBACK_TOKEN_TTL_SEC * 1000).toISOString(),
      ttlSec: MUX_PLAYBACK_TOKEN_TTL_SEC,
      mode: "local",
      token: null,
      playerUrl: null,
      mediaUrl: `/api/media/recording/${authz.lessonId}`,
    };
  }

  if (!authz.playbackId || authz.playbackId.startsWith("demo_")) {
    // Fixture / demo playback — authorize then issue fixture token (not Mux CDN).
    const fixtureId = authz.playbackId || `fixture_${authz.recordingId.slice(0, 8)}`;
    const signed = signFixturePlaybackToken({
      playbackId: fixtureId,
      userId: input.userId,
      recordingId: authz.recordingId,
    });
    await writeAuditLog({
      actorId: input.userId,
      action: "recording.playback_token",
      entityType: "Recording",
      entityId: authz.recordingId,
      metadata: { mode: "fixture", role: authz.role },
    });
    return {
      ok: true,
      recordingId: authz.recordingId,
      lessonId: authz.lessonId,
      expiresAt: signed.expiresAt.toISOString(),
      ttlSec: signed.ttlSec,
      mode: "fixture",
      token: signed.token,
      playerUrl: null,
      mediaUrl: authz.storageKey ? `/api/media/recording/${authz.lessonId}` : null,
    };
  }

  if (!isMuxSigningConfigured()) {
    // Do NOT fall back to public Mux URL when Wave 2 is on.
    return { ok: false, status: 503, code: "SIGNING_NOT_CONFIGURED" };
  }

  try {
    const signed = signMuxPlaybackToken({ playbackId: authz.playbackId });
    await writeAuditLog({
      actorId: input.userId,
      action: "recording.playback_token",
      entityType: "Recording",
      entityId: authz.recordingId,
      metadata: { mode: "mux", role: authz.role, ttlSec: signed.ttlSec },
    });
    return {
      ok: true,
      recordingId: authz.recordingId,
      lessonId: authz.lessonId,
      expiresAt: signed.expiresAt.toISOString(),
      ttlSec: signed.ttlSec,
      mode: "mux",
      token: signed.token,
      playerUrl: muxSignedPlayerUrl(authz.playbackId, signed.token),
      mediaUrl: null,
    };
  } catch {
    return { ok: false, status: 503, code: "SIGNING_FAILED" };
  }
}
