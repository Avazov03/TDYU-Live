/**
 * Phase 5 Wave 2 — Enrollment-first student catalog ownership (pure helpers).
 *
 *   npx tsx --test src/lib/student-catalog.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isStudentCourseOwned,
  mergeStudentOwnedCourseIds,
} from "./access";

const COURSE_A = "course-a";
const COURSE_B = "course-b";
const COURSE_C = "course-c";

describe("Wave 2 student catalog ownership", () => {
  it("A one Enrollment → one owned course (enrollment mode)", () => {
    const ids = mergeStudentOwnedCourseIds({
      mode: "enrollment",
      enrollmentCourseIds: [COURSE_A],
      activeSubscriptionCourseIds: [COURSE_C],
    });
    assert.deepEqual(ids, [COURSE_A]);
  });

  it("B two Enrollments → both courses", () => {
    const ids = mergeStudentOwnedCourseIds({
      mode: "enrollment",
      enrollmentCourseIds: [COURSE_A, COURSE_B],
      activeSubscriptionCourseIds: [],
    });
    assert.equal(ids.length, 2);
    assert.ok(ids.includes(COURSE_A) && ids.includes(COURSE_B));
  });

  it("C no Enrollment → empty My Courses (enrollment mode)", () => {
    const ids = mergeStudentOwnedCourseIds({
      mode: "enrollment",
      enrollmentCourseIds: [],
      activeSubscriptionCourseIds: [COURSE_A],
    });
    assert.deepEqual(ids, []);
  });

  it("D legacy Subscription alone → not target ownership", () => {
    const ids = mergeStudentOwnedCourseIds({
      mode: "enrollment",
      enrollmentCourseIds: [],
      activeSubscriptionCourseIds: [COURSE_A, COURSE_B],
    });
    assert.deepEqual(ids, []);
    assert.equal(
      isStudentCourseOwned({
        mode: "enrollment",
        hasOpenEnrollment: false,
        hasActiveSubscription: true,
      }),
      false,
    );
  });

  it("E closed/refunded seat excluded from enrollmentCourseIds input", () => {
    // Caller only passes open seats — closed B must not appear.
    const ids = mergeStudentOwnedCourseIds({
      mode: "enrollment",
      enrollmentCourseIds: [COURSE_A],
      activeSubscriptionCourseIds: [COURSE_B],
    });
    assert.deepEqual(ids, [COURSE_A]);
    assert.ok(!ids.includes(COURSE_B));
  });

  it("F Course A ownership does not imply Course B", () => {
    const ids = mergeStudentOwnedCourseIds({
      mode: "enrollment",
      enrollmentCourseIds: [COURSE_A],
      activeSubscriptionCourseIds: [COURSE_B],
    });
    assert.ok(ids.includes(COURSE_A));
    assert.ok(!ids.includes(COURSE_B));
    assert.equal(
      isStudentCourseOwned({
        mode: "enrollment",
        hasOpenEnrollment: false,
        hasActiveSubscription: true,
      }),
      false,
    );
  });

  it("G completed Enrollment retained (same open-seat list)", () => {
    const ids = mergeStudentOwnedCourseIds({
      mode: "enrollment",
      enrollmentCourseIds: [COURSE_A],
      activeSubscriptionCourseIds: [],
    });
    assert.deepEqual(ids, [COURSE_A]);
    assert.equal(
      isStudentCourseOwned({
        mode: "enrollment",
        hasOpenEnrollment: true,
        hasActiveSubscription: false,
      }),
      true,
    );
  });

  it("H closing B leaves A (independent seats)", () => {
    const before = mergeStudentOwnedCourseIds({
      mode: "enrollment",
      enrollmentCourseIds: [COURSE_A, COURSE_B],
      activeSubscriptionCourseIds: [],
    });
    const after = mergeStudentOwnedCourseIds({
      mode: "enrollment",
      enrollmentCourseIds: [COURSE_A],
      activeSubscriptionCourseIds: [],
    });
    assert.equal(before.length, 2);
    assert.deepEqual(after, [COURSE_A]);
  });

  it("off|shadow still uses Subscription for listing compatibility", () => {
    assert.deepEqual(
      mergeStudentOwnedCourseIds({
        mode: "shadow",
        enrollmentCourseIds: [COURSE_A],
        activeSubscriptionCourseIds: [COURSE_B],
      }),
      [COURSE_B],
    );
  });

  it("dual unions Enrollment and Subscription without duplicate", () => {
    const ids = mergeStudentOwnedCourseIds({
      mode: "dual",
      enrollmentCourseIds: [COURSE_A],
      activeSubscriptionCourseIds: [COURSE_A, COURSE_B],
    });
    assert.equal(ids.length, 2);
    assert.ok(ids.includes(COURSE_A) && ids.includes(COURSE_B));
  });
});
