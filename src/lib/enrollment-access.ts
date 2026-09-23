/**
 * Target Enrollment-based course access (Phase 2).
 *
 * Scoped to (userId, courseId). Never expires other courses.
 * Does NOT use Subscription.endsAt for denial (permanent replay compatible).
 * Does NOT use TariffTier for base seat access (live tier gates stay on legacy path until tariff removal).
 * Does NOT treat purchaseAllowed / isBlocked as enrollment wipe.
 *
 * Server-side only — do not expose raw Enrollment rows to the client.
 */

import type { EnrollmentStatus, LessonStatus, TariffTier } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { canWatchLive } from "@/lib/tariffs";

export type EnrollmentAccessReason =
  | "unauthenticated"
  | "no_enrollment"
  | "inactive"
  | "access_closed"
  | "not_started"
  | "live_locked";

export type EnrollmentAccessResult =
  | { ok: true; source: "enrollment"; enrollmentId: string; status: EnrollmentStatus }
  | { ok: false; source: "enrollment"; reason: EnrollmentAccessReason };

export type LegacyAccessLike =
  | { ok: true; tier: TariffTier }
  | { ok: false; reason: string };

export type AccessCompareVerdict = "MATCH" | "MISMATCH";

/** Seat open for course content (recording/materials/live) when status allows + accessOpen. */
export function isEnrollmentSeatOpen(row: {
  status: EnrollmentStatus;
  accessOpen: boolean;
}): boolean {
  if (!row.accessOpen) return false;
  return row.status === "active" || row.status === "completed";
}

/**
 * Pure evaluator for tests / shadow compare.
 * `applyLegacyLiveTier` — when true, mirror OLD live_locked using optional tier
 * so mapped ACTIVE seats can MATCH during shadow. Target cutover sets this false.
 */
export function evaluateEnrollmentLessonAccess(input: {
  userId: string | undefined;
  courseId: string;
  lessonStatus: LessonStatus;
  enrollment: {
    id: string;
    courseId: string;
    status: EnrollmentStatus;
    accessOpen: boolean;
  } | null;
  /** Optional: only for shadow parity with Tariff live gates. */
  applyLegacyLiveTier?: boolean;
  legacyTier?: TariffTier | null;
}): EnrollmentAccessResult {
  if (!input.userId) {
    return { ok: false, source: "enrollment", reason: "unauthenticated" };
  }
  const enr = input.enrollment;
  if (!enr || enr.courseId !== input.courseId) {
    return { ok: false, source: "enrollment", reason: "no_enrollment" };
  }
  if (!enr.accessOpen) {
    return { ok: false, source: "enrollment", reason: "access_closed" };
  }
  if (enr.status !== "active" && enr.status !== "completed") {
    return { ok: false, source: "enrollment", reason: "inactive" };
  }
  if (input.lessonStatus === "scheduled") {
    return { ok: false, source: "enrollment", reason: "not_started" };
  }
  if (
    input.applyLegacyLiveTier &&
    (input.lessonStatus === "live" || input.lessonStatus === "lobby") &&
    !canWatchLive(input.legacyTier)
  ) {
    return { ok: false, source: "enrollment", reason: "live_locked" };
  }
  return {
    ok: true,
    source: "enrollment",
    enrollmentId: enr.id,
    status: enr.status,
  };
}

export async function getEnrollmentLessonAccess(
  userId: string | undefined,
  courseId: string,
  lessonStatus: LessonStatus,
  opts?: { applyLegacyLiveTier?: boolean; legacyTier?: TariffTier | null },
): Promise<EnrollmentAccessResult> {
  if (!userId) {
    return { ok: false, source: "enrollment", reason: "unauthenticated" };
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: { userId, courseId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      courseId: true,
      status: true,
      accessOpen: true,
    },
  });

  return evaluateEnrollmentLessonAccess({
    userId,
    courseId,
    lessonStatus,
    enrollment,
    applyLegacyLiveTier: opts?.applyLegacyLiveTier,
    legacyTier: opts?.legacyTier,
  });
}

export function compareAccessOutcomes(
  oldOk: boolean,
  newOk: boolean,
): AccessCompareVerdict {
  return oldOk === newOk ? "MATCH" : "MISMATCH";
}

/**
 * Structured shadow log — server-side only. Never throws.
 * Uses console.warn so mismatches are visible in logs without changing UX.
 */
export function logAccessShadowCompare(payload: {
  userId: string;
  courseId: string;
  lessonStatus: LessonStatus;
  old: LegacyAccessLike;
  neu: EnrollmentAccessResult;
  verdict: AccessCompareVerdict;
}) {
  try {
    console.warn(
      "[access-shadow]",
      JSON.stringify({
        userId: payload.userId,
        courseId: payload.courseId,
        lessonStatus: payload.lessonStatus,
        oldOk: payload.old.ok,
        oldReason: payload.old.ok ? null : payload.old.reason,
        newOk: payload.neu.ok,
        newReason: payload.neu.ok ? null : payload.neu.reason,
        verdict: payload.verdict,
      }),
    );
  } catch {
    // never break request path
  }
}
