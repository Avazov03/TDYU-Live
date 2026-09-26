/**
 * Phase 8.5 — live Mux playback authorization for /learn and /shorts (Enrollment-authoritative).
 *
 * Gated by FF_LIVE_MUX_PLAYBACK_V1, which is effective only in FF_ENROLLMENT_ACCESS_MODE=enrollment,
 * so this path, the WebRTC room (authorizeLiveJoin → getLessonAccess), attendance and recordings
 * share one rule: enrolled student / owning teacher / admin.
 *
 * Live-only — replay comes exclusively from the Recording lifecycle (resolveReplayPlaybackId).
 * Playback is public until a Mux signing key exists; `resolveLivePlaybackSource` is the only
 * place that builds the player URL, and it is returned only while the stream is active.
 */

import { prisma } from "@/lib/prisma";
import {
  getEnrollmentLessonAccess,
  type EnrollmentAccessResult,
} from "@/lib/enrollment-access";
import { isLiveMuxPlaybackV1Enabled, isLiveWaitingRoomV2Enabled } from "@/lib/feature-flags";
import { findActiveLiveSession } from "@/lib/live-session";
import {
  fetchMuxLiveStreamStatus,
  type MuxClientOptions,
  type MuxLiveStreamStatusResult,
} from "@/lib/mux-client";
import { muxPublicPlayerUrl } from "@/lib/mux-signed-playback";
import { isAdminRole, isTeacherRole } from "@/lib/roles";

export type LiveMuxDenyReason =
  | "disabled"
  | "unauthenticated"
  | "not_found"
  | "not_enrolled"
  | "not_live"
  | "no_playback";

export type LiveMuxPlaybackDecision =
  | { ok: true; playbackId: string; liveStreamId: string; viewer: "student" | "staff" }
  | { ok: false; reason: LiveMuxDenyReason };

export type LiveMuxStatus = MuxLiveStreamStatusResult["status"];

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
  if (!isLiveMuxPlaybackV1Enabled()) return { ok: false, reason: "disabled" };
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

export type LivePlaybackSource = { mode: "public"; playerUrl: string };

/**
 * Single seam for live player URLs. Signed live playback (once MUX_SIGNING_KEY_ID /
 * MUX_SIGNING_PRIVATE_KEY exist and new streams use a signed policy) plugs in here.
 */
export function resolveLivePlaybackSource(playbackId: string): LivePlaybackSource {
  return { mode: "public", playerUrl: muxPublicPlayerUrl(playbackId) };
}

const STATUS_TTL_MS = 10_000;
const DEGRADED_TTL_MS = 5_000;
const STATUS_CACHE_MAX = 500;

type CacheEntry = { result: MuxLiveStreamStatusResult; at: number };
const statusCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<MuxLiveStreamStatusResult>>();

export function resetLiveMuxStatusCacheForTests(): void {
  statusCache.clear();
  inflight.clear();
}

function logDegraded(result: MuxLiveStreamStatusResult, liveStreamId: string, lessonId?: string) {
  if (result.degraded === null || result.degraded === "demo") return;
  console.warn(
    JSON.stringify({
      event: "live_mux.status_degraded",
      reason: result.degraded,
      lessonId: lessonId ?? null,
      streamRef: liveStreamId.slice(0, 6),
      at: new Date().toISOString(),
    }),
  );
}

/**
 * Server-side Mux status with timeout, short cache and in-flight dedupe so N polling viewers
 * cause at most one Mux call per stream per TTL. Never throws; failures resolve to "unknown".
 */
export async function getLiveMuxStatus(
  liveStreamId: string,
  lessonId?: string,
  opts: MuxClientOptions & { now?: () => number } = {},
): Promise<MuxLiveStreamStatusResult> {
  const now = opts.now ?? Date.now;
  const hit = statusCache.get(liveStreamId);
  if (hit) {
    const ttl = hit.result.degraded ? DEGRADED_TTL_MS : STATUS_TTL_MS;
    if (now() - hit.at < ttl) return hit.result;
  }
  const pending = inflight.get(liveStreamId);
  if (pending) return pending;

  const task = fetchMuxLiveStreamStatus(liveStreamId, opts)
    .then((result) => {
      if (statusCache.size >= STATUS_CACHE_MAX) {
        const oldest = statusCache.keys().next().value;
        if (oldest !== undefined) statusCache.delete(oldest);
      }
      statusCache.set(liveStreamId, { result, at: now() });
      logDegraded(result, liveStreamId, lessonId);
      return result;
    })
    .finally(() => inflight.delete(liveStreamId));
  inflight.set(liveStreamId, task);
  return task;
}
