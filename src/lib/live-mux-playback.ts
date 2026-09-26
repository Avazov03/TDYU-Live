/**
 * Phase 8.5 — live Mux playback authorization for /learn (enrollment-authoritative).
 *
 * TEMPORARY: live playback IDs are public until the Mux signing key exists.
 * Live-only — never use this path for recordings / replay (see recording-playback-auth).
 *
 * Access source: Enrollment (never Subscription / TariffTier).
 * The client receives only the playback ID and a Mux status word.
 */

import { prisma } from "@/lib/prisma";
import {
  getEnrollmentLessonAccess,
  type EnrollmentAccessResult,
} from "@/lib/enrollment-access";
import { isLiveWaitingRoomV2Enabled } from "@/lib/feature-flags";
import { findActiveLiveSession } from "@/lib/live-session";
import { readMuxLiveStreamStatus, type MuxLiveStreamStatus } from "@/lib/mux-read-only";
import { isAdminRole, isTeacherRole } from "@/lib/roles";

export type LiveMuxDenyReason =
  | "unauthenticated"
  | "not_found"
  | "not_enrolled"
  | "not_live"
  | "no_playback";

export type LiveMuxPlaybackDecision =
  | { ok: true; playbackId: string; liveStreamId: string; viewer: "student" | "staff" }
  | { ok: false; reason: LiveMuxDenyReason };

export type LiveMuxStatus = MuxLiveStreamStatus | "unknown";

export function isRealMuxId(id: string | null | undefined): id is string {
  return Boolean(id && !id.startsWith("demo_"));
}

/** Pure decision (unit-tested). `sessionLive` is null when LiveSession is not authoritative (flag off). */
export function evaluateLiveMuxPlayback(input: {
  userId: string | undefined;
  staff: boolean;
  lessonStatus: string;
  sessionLive: boolean | null;
  playbackId: string | null;
  liveStreamId: string | null;
  enrollment: EnrollmentAccessResult | null;
}): LiveMuxPlaybackDecision {
  if (!input.userId) return { ok: false, reason: "unauthenticated" };
  const seatOpen =
    input.enrollment?.ok === true ||
    (input.enrollment?.ok === false && input.enrollment.reason === "not_started");
  if (!input.staff && !seatOpen) return { ok: false, reason: "not_enrolled" };
  if (input.lessonStatus !== "live" || input.sessionLive === false) {
    return { ok: false, reason: "not_live" };
  }
  if (!isRealMuxId(input.playbackId) || !isRealMuxId(input.liveStreamId)) {
    return { ok: false, reason: "no_playback" };
  }
  return {
    ok: true,
    playbackId: input.playbackId,
    liveStreamId: input.liveStreamId,
    viewer: input.staff ? "staff" : "student",
  };
}

export async function authorizeLiveMuxPlayback(input: {
  userId: string | undefined;
  role: string | undefined;
  lessonId: string;
}): Promise<LiveMuxPlaybackDecision> {
  if (!input.userId) return { ok: false, reason: "unauthenticated" };
  const lesson = await prisma.lesson.findUnique({
    where: { id: input.lessonId },
    select: {
      id: true,
      courseId: true,
      status: true,
      muxLivePlaybackId: true,
      muxLiveStreamId: true,
      course: { select: { teacher: { select: { userId: true } } } },
    },
  });
  if (!lesson) return { ok: false, reason: "not_found" };

  const role = input.role ?? "";
  const staff =
    isAdminRole(role) || (isTeacherRole(role) && lesson.course.teacher.userId === input.userId);
  const enrollment = staff
    ? null
    : await getEnrollmentLessonAccess(input.userId, lesson.courseId, lesson.status);

  let sessionLive: boolean | null = null;
  if (isLiveWaitingRoomV2Enabled() && lesson.status === "live") {
    const session = await findActiveLiveSession(lesson.id);
    sessionLive = session?.status === "live" || session?.status === "paused";
  }

  return evaluateLiveMuxPlayback({
    userId: input.userId,
    staff,
    lessonStatus: lesson.status,
    sessionLive,
    playbackId: lesson.muxLivePlaybackId,
    liveStreamId: lesson.muxLiveStreamId,
    enrollment,
  });
}

const STATUS_TTL_MS = 5_000;
const statusCache = new Map<string, { status: LiveMuxStatus; at: number }>();

/** Server-side Mux status (GET only, cached briefly so polling viewers don't fan out to Mux). */
export async function getLiveMuxStatus(liveStreamId: string): Promise<LiveMuxStatus> {
  const hit = statusCache.get(liveStreamId);
  if (hit && Date.now() - hit.at < STATUS_TTL_MS) return hit.status;
  let status: LiveMuxStatus = "unknown";
  try {
    status = (await readMuxLiveStreamStatus(liveStreamId)) ?? "unknown";
  } catch {
    status = "unknown";
  }
  statusCache.set(liveStreamId, { status, at: Date.now() });
  return status;
}
