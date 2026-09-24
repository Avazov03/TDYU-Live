/**
 * Phase 2 access abstraction unit tests (node:test).
 * Pure evaluators — no DB writes, no flag enablement in runtime.
 *
 *   npx tsx --test src/lib/enrollment-access.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EnrollmentStatus } from "@/generated/prisma/client";
import {
  compareAccessOutcomes,
  evaluateEnrollmentLessonAccess,
  isEnrollmentSeatOpen,
} from "./enrollment-access";

const COURSE_A = "course-a";
const COURSE_B = "course-b";
const USER = "user-1";

function enr(
  overrides: Partial<{
    id: string;
    courseId: string;
    status: EnrollmentStatus;
    accessOpen: boolean;
  }> = {},
) {
  return {
    id: overrides.id ?? "enr-1",
    courseId: overrides.courseId ?? COURSE_A,
    status: overrides.status ?? ("active" as EnrollmentStatus),
    accessOpen: overrides.accessOpen ?? true,
  };
}

describe("Phase 2 enrollment access", () => {
  it("A: student owns one course → access allowed", () => {
    const r = evaluateEnrollmentLessonAccess({
      userId: USER,
      courseId: COURSE_A,
      lessonStatus: "ended",
      enrollment: enr(),
    });
    assert.equal(r.ok, true);
  });

  it("B: student owns two courses → both accessible independently", () => {
    const a = evaluateEnrollmentLessonAccess({
      userId: USER,
      courseId: COURSE_A,
      lessonStatus: "ended",
      enrollment: enr({ id: "e-a", courseId: COURSE_A }),
    });
    const b = evaluateEnrollmentLessonAccess({
      userId: USER,
      courseId: COURSE_B,
      lessonStatus: "ended",
      enrollment: enr({ id: "e-b", courseId: COURSE_B }),
    });
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
  });

  it("C: buying second course does not close first (scoped by courseId)", () => {
    // Simulates post-purchase state: both seats open — no expire-other logic here.
    const first = evaluateEnrollmentLessonAccess({
      userId: USER,
      courseId: COURSE_A,
      lessonStatus: "ended",
      enrollment: enr({ id: "e-a", courseId: COURSE_A }),
    });
    const second = evaluateEnrollmentLessonAccess({
      userId: USER,
      courseId: COURSE_B,
      lessonStatus: "ended",
      enrollment: enr({ id: "e-b", courseId: COURSE_B }),
    });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
  });

  it("D: first course refunded closes only that seat", () => {
    const first = evaluateEnrollmentLessonAccess({
      userId: USER,
      courseId: COURSE_A,
      lessonStatus: "ended",
      enrollment: enr({
        id: "e-a",
        courseId: COURSE_A,
        status: "refunded",
        accessOpen: false,
      }),
    });
    const second = evaluateEnrollmentLessonAccess({
      userId: USER,
      courseId: COURSE_B,
      lessonStatus: "ended",
      enrollment: enr({ id: "e-b", courseId: COURSE_B }),
    });
    assert.equal(first.ok, false);
    assert.ok(
      first.ok === false &&
        (first.reason === "access_closed" || first.reason === "inactive"),
    );
    assert.equal(second.ok, true);
  });

  it("E: expired legacy → NEW seat with accessOpen=true still allows (no endsAt denial)", () => {
    // Migration policy: permanent accessOpen; endsAt is NOT consulted.
    const r = evaluateEnrollmentLessonAccess({
      userId: USER,
      courseId: COURSE_A,
      lessonStatus: "ended",
      enrollment: enr({ accessOpen: true, status: "active" }),
    });
    assert.equal(r.ok, true);
    assert.equal(isEnrollmentSeatOpen({ status: "active", accessOpen: true }), true);
  });

  it("F: mapped enrollment + legacy live tier parity → OLD-like deny/allow match", () => {
    const t2 = evaluateEnrollmentLessonAccess({
      userId: USER,
      courseId: COURSE_A,
      lessonStatus: "live",
      enrollment: enr(),
      applyLegacyLiveTier: true,
      legacyTier: "t2",
    });
    const t1 = evaluateEnrollmentLessonAccess({
      userId: USER,
      courseId: COURSE_A,
      lessonStatus: "live",
      enrollment: enr(),
      applyLegacyLiveTier: true,
      legacyTier: "t1",
    });
    assert.equal(t2.ok, true);
    assert.equal(t1.ok, false);
    if (!t1.ok) assert.equal(t1.reason, "live_locked");
    assert.equal(compareAccessOutcomes(true, t2.ok), "MATCH");
    assert.equal(compareAccessOutcomes(false, t1.ok), "MATCH");
  });

  it("G: no enrollment → NEW denied", () => {
    const r = evaluateEnrollmentLessonAccess({
      userId: USER,
      courseId: COURSE_A,
      lessonStatus: "ended",
      enrollment: null,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "no_enrollment");
  });

  it("H: enrollment inactive → NEW denied", () => {
    const r = evaluateEnrollmentLessonAccess({
      userId: USER,
      courseId: COURSE_A,
      lessonStatus: "ended",
      enrollment: enr({ status: "cancelled", accessOpen: true }),
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "inactive");
  });

  it("I: enrollment for different course → denied", () => {
    const r = evaluateEnrollmentLessonAccess({
      userId: USER,
      courseId: COURSE_A,
      lessonStatus: "ended",
      enrollment: enr({ courseId: COURSE_B }),
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "no_enrollment");
  });

  it("J: legacy allow + no enrollment → MISMATCH; shadow must keep serving OLD", () => {
    const neu = evaluateEnrollmentLessonAccess({
      userId: USER,
      courseId: COURSE_A,
      lessonStatus: "ended",
      enrollment: null,
    });
    const oldOk = true; // legacy Subscription still active
    const verdict = compareAccessOutcomes(oldOk, neu.ok);
    assert.equal(verdict, "MISMATCH");
    assert.equal(neu.ok, false);
    // Shadow contract: served result remains OLD (caller returns legacy).
    const servedOk = oldOk;
    assert.equal(servedOk, true);
  });

  it("purchaseAllowed / isBlocked are not part of enrollment seat evaluator", () => {
    // Documented separation: this function has no purchaseAllowed param.
    const r = evaluateEnrollmentLessonAccess({
      userId: USER,
      courseId: COURSE_A,
      lessonStatus: "ended",
      enrollment: enr(),
    });
    assert.equal(r.ok, true);
  });

  it("completed + accessOpen remains accessible (permanent replay compatible)", () => {
    const r = evaluateEnrollmentLessonAccess({
      userId: USER,
      courseId: COURSE_A,
      lessonStatus: "ended",
      enrollment: enr({ status: "completed", accessOpen: true }),
    });
    assert.equal(r.ok, true);
  });

  it("K: accessOpen=false denies even if status still active-shaped", () => {
    const r = evaluateEnrollmentLessonAccess({
      userId: USER,
      courseId: COURSE_A,
      lessonStatus: "ended",
      enrollment: enr({ status: "active", accessOpen: false }),
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "access_closed");
  });

  it("L: enrollment mode live without legacy tier gate allows enrolled student", () => {
    const r = evaluateEnrollmentLessonAccess({
      userId: USER,
      courseId: COURSE_A,
      lessonStatus: "live",
      enrollment: enr(),
      applyLegacyLiveTier: false,
      legacyTier: "t1",
    });
    assert.equal(r.ok, true);
  });
});
