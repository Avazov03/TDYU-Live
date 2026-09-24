/**
 * Phase 2.6 — Enrollment-authoritative mode matrix (pure helpers + flag parsing).
 * No DB. Does not enable staging flags.
 *
 *   npx tsx --test src/lib/access-mode.test.ts
 */

import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import {
  getEnrollmentAccessMode,
  usesEnrollmentAccessPath,
} from "./feature-flags";
import {
  compareAccessOutcomes,
  evaluateEnrollmentLessonAccess,
} from "./enrollment-access";

describe("FF_ENROLLMENT_ACCESS_MODE parsing", () => {
  const prevMode = process.env.FF_ENROLLMENT_ACCESS_MODE;
  const prevCompat = process.env.FF_ENROLLMENT_ACCESS;

  afterEach(() => {
    if (prevMode === undefined) delete process.env.FF_ENROLLMENT_ACCESS_MODE;
    else process.env.FF_ENROLLMENT_ACCESS_MODE = prevMode;
    if (prevCompat === undefined) delete process.env.FF_ENROLLMENT_ACCESS;
    else process.env.FF_ENROLLMENT_ACCESS = prevCompat;
  });

  it("defaults to off", () => {
    delete process.env.FF_ENROLLMENT_ACCESS_MODE;
    delete process.env.FF_ENROLLMENT_ACCESS;
    assert.equal(getEnrollmentAccessMode(), "off");
    assert.equal(usesEnrollmentAccessPath(), false);
  });

  it("accepts enrollment authoritative mode", () => {
    process.env.FF_ENROLLMENT_ACCESS_MODE = "enrollment";
    assert.equal(getEnrollmentAccessMode(), "enrollment");
    assert.equal(usesEnrollmentAccessPath(), true);
  });

  it("shadow and dual remain valid", () => {
    process.env.FF_ENROLLMENT_ACCESS_MODE = "shadow";
    assert.equal(getEnrollmentAccessMode(), "shadow");
    process.env.FF_ENROLLMENT_ACCESS_MODE = "dual";
    assert.equal(getEnrollmentAccessMode(), "dual");
    assert.equal(usesEnrollmentAccessPath(), true);
  });
});

describe("Phase 2.6 cutover matrix (evaluator)", () => {
  const USER = "u1";
  const A = "course-a";
  const B = "course-b";

  it("A active Enrollment → ALLOW", () => {
    const r = evaluateEnrollmentLessonAccess({
      userId: USER,
      courseId: A,
      lessonStatus: "ended",
      enrollment: { id: "e1", courseId: A, status: "active", accessOpen: true },
    });
    assert.equal(r.ok, true);
  });

  it("B completed Enrollment → ALLOW", () => {
    const r = evaluateEnrollmentLessonAccess({
      userId: USER,
      courseId: A,
      lessonStatus: "ended",
      enrollment: { id: "e1", courseId: A, status: "completed", accessOpen: true },
    });
    assert.equal(r.ok, true);
  });

  it("C accessOpen=false → DENY", () => {
    const r = evaluateEnrollmentLessonAccess({
      userId: USER,
      courseId: A,
      lessonStatus: "ended",
      enrollment: { id: "e1", courseId: A, status: "active", accessOpen: false },
    });
    assert.equal(r.ok, false);
  });

  it("D refunded → DENY", () => {
    const r = evaluateEnrollmentLessonAccess({
      userId: USER,
      courseId: A,
      lessonStatus: "ended",
      enrollment: { id: "e1", courseId: A, status: "refunded", accessOpen: false },
    });
    assert.equal(r.ok, false);
  });

  it("E no Enrollment → DENY", () => {
    const r = evaluateEnrollmentLessonAccess({
      userId: USER,
      courseId: A,
      lessonStatus: "ended",
      enrollment: null,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "no_enrollment");
  });

  it("F Enrollment A cannot open Course B", () => {
    const r = evaluateEnrollmentLessonAccess({
      userId: USER,
      courseId: B,
      lessonStatus: "ended",
      enrollment: { id: "e1", courseId: A, status: "active", accessOpen: true },
    });
    assert.equal(r.ok, false);
  });

  it("G Enrollment B opens Course B", () => {
    const r = evaluateEnrollmentLessonAccess({
      userId: USER,
      courseId: B,
      lessonStatus: "ended",
      enrollment: { id: "e2", courseId: B, status: "active", accessOpen: true },
    });
    assert.equal(r.ok, true);
  });

  it("H completed course replay → ALLOW", () => {
    const r = evaluateEnrollmentLessonAccess({
      userId: USER,
      courseId: A,
      lessonStatus: "ended",
      enrollment: { id: "e1", courseId: A, status: "completed", accessOpen: true },
    });
    assert.equal(r.ok, true);
  });

  it("I legacy expired vs Enrollment open → MISMATCH (shadow keeps OLD deny)", () => {
    const neu = evaluateEnrollmentLessonAccess({
      userId: USER,
      courseId: A,
      lessonStatus: "ended",
      enrollment: { id: "e1", courseId: A, status: "active", accessOpen: true },
    });
    const oldOk = false; // Subscription.endsAt expired
    assert.equal(neu.ok, true);
    assert.equal(compareAccessOutcomes(oldOk, neu.ok), "MISMATCH");
  });

  it("J legacy Subscription allow + no Enrollment → MISMATCH; enrollment mode serves DENY", () => {
    const neu = evaluateEnrollmentLessonAccess({
      userId: USER,
      courseId: A,
      lessonStatus: "ended",
      enrollment: null,
    });
    const oldOk = true;
    assert.equal(compareAccessOutcomes(oldOk, neu.ok), "MISMATCH");
    assert.equal(neu.ok, false);
  });

  it("K multi-course independent seats", () => {
    const a = evaluateEnrollmentLessonAccess({
      userId: USER,
      courseId: A,
      lessonStatus: "ended",
      enrollment: { id: "ea", courseId: A, status: "active", accessOpen: true },
    });
    const b = evaluateEnrollmentLessonAccess({
      userId: USER,
      courseId: B,
      lessonStatus: "ended",
      enrollment: { id: "eb", courseId: B, status: "completed", accessOpen: true },
    });
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
  });

  it("L shared URL without enrollment → DENY", () => {
    const r = evaluateEnrollmentLessonAccess({
      userId: undefined,
      courseId: A,
      lessonStatus: "ended",
      enrollment: null,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "unauthenticated");
  });
});
