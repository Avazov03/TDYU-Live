/**
 * Course lifecycle review policy (FF_COURSE_REVIEW_V1).
 *   npx tsx --test src/lib/course-review.test.ts
 */

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { CourseLifecycleStatus } from "@/generated/prisma/client";
import {
  checkCourseReviewAction,
  isLiveAllowedForCourse,
  isPreAudienceLifecycle,
  isTeacherEditableLifecycle,
  lessonPlanLock,
  liveGate,
  type ReviewCheckInput,
} from "./course-review-policy";
import { isCourseReviewV1Enabled } from "./feature-flags";

const goodCourse = {
  titleUz: "Konstitutsiyaviy huquq",
  descriptionUz: "Konstitutsiyaviy huquq asoslari bo‘yicha jonli kurs.",
  lessonCount: 3,
};

function check(partial: Partial<ReviewCheckInput>) {
  return checkCourseReviewAction({
    action: "submit",
    actor: "owner_teacher",
    current: "draft",
    course: goodCourse,
    ...partial,
  });
}

describe("course review flag", () => {
  afterEach(() => {
    delete process.env.FF_COURSE_REVIEW_V1;
  });
  it("defaults on", () => {
    delete process.env.FF_COURSE_REVIEW_V1;
    assert.equal(isCourseReviewV1Enabled(), true);
  });
  it("explicit false rolls back", () => {
    process.env.FF_COURSE_REVIEW_V1 = "false";
    assert.equal(isCourseReviewV1Enabled(), false);
  });
  it("reads env per call", () => {
    process.env.FF_COURSE_REVIEW_V1 = "true";
    assert.equal(isCourseReviewV1Enabled(), true);
  });
});

describe("submit", () => {
  it("draft → submitted by owner", () => {
    assert.deepEqual(check({}), { ok: true, to: "submitted" });
  });
  it("changes_requested → submitted (resubmit)", () => {
    assert.deepEqual(check({ current: "changes_requested" }), { ok: true, to: "submitted" });
  });
  it("admin cannot submit on behalf of teacher", () => {
    const r = check({ actor: "admin" });
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.code, "FORBIDDEN");
  });
  it("non-owner is forbidden", () => {
    const r = check({ actor: null });
    assert.equal(!r.ok && r.code, "FORBIDDEN");
  });
  for (const current of ["submitted", "in_review", "approved", "published", "rejected"] as const) {
    it(`cannot submit from ${current}`, () => {
      const r = check({ current });
      assert.equal(!r.ok && r.code, "INVALID_TRANSITION");
    });
  }
  it("legacy course (null lifecycle) cannot enter review", () => {
    const r = check({ current: null });
    assert.equal(!r.ok && r.code, "INVALID_TRANSITION");
  });
  it("requires description ≥ 20 chars", () => {
    const r = check({ course: { ...goodCourse, descriptionUz: "qisqa" } });
    assert.equal(!r.ok && r.code, "VALIDATION");
  });
  it("requires at least one lesson", () => {
    const r = check({ course: { ...goodCourse, lessonCount: 0 } });
    assert.equal(!r.ok && r.code, "VALIDATION");
  });
});

describe("admin decisions", () => {
  const admin = { actor: "admin" as const, current: "submitted" as const };

  it("start_review only from submitted", () => {
    assert.deepEqual(check({ ...admin, action: "start_review" }), { ok: true, to: "in_review" });
    const r = check({ ...admin, action: "start_review", current: "in_review" });
    assert.equal(!r.ok && r.code, "INVALID_TRANSITION");
  });
  it("teacher cannot approve own course", () => {
    const r = check({ action: "approve", actor: "owner_teacher", current: "submitted", listPrice: 500000 });
    assert.equal(!r.ok && r.code, "FORBIDDEN");
  });
  it("request_changes needs a reason", () => {
    const r = check({ ...admin, action: "request_changes", reason: "  " });
    assert.equal(!r.ok && r.code, "VALIDATION");
    assert.deepEqual(
      check({ ...admin, action: "request_changes", reason: "Tavsifni kengaytiring" }),
      { ok: true, to: "changes_requested" },
    );
  });
  it("reject needs a reason and works from in_review", () => {
    assert.deepEqual(
      check({ ...admin, current: "in_review", action: "reject", reason: "Mavzu takrorlanadi" }),
      { ok: true, to: "rejected" },
    );
  });
  it("approve requires integer price ≥ 1000", () => {
    for (const listPrice of [null, 0, 999, 1500.5, -1]) {
      const r = check({ ...admin, action: "approve", listPrice });
      assert.equal(!r.ok && r.code, "VALIDATION", `price ${listPrice}`);
    }
    assert.deepEqual(check({ ...admin, action: "approve", listPrice: 450000 }), {
      ok: true,
      to: "approved",
    });
  });
  it("approve capacity: empty = unlimited, else integer 1..10000", () => {
    for (const capacity of [null, undefined, 1, 30, 10000]) {
      assert.deepEqual(
        check({ ...admin, action: "approve", listPrice: 450000, capacity }),
        { ok: true, to: "approved" },
        `capacity ${capacity}`,
      );
    }
    for (const capacity of [0, -3, 2.5, 10001]) {
      const r = check({ ...admin, action: "approve", listPrice: 450000, capacity });
      assert.equal(!r.ok && r.code, "VALIDATION", `capacity ${capacity}`);
    }
  });
  it("cannot publish before approval", () => {
    const r = check({ ...admin, action: "publish" });
    assert.equal(!r.ok && r.code, "INVALID_TRANSITION");
  });
  it("publish → upcoming when a lesson is ahead, else published", () => {
    const base = { actor: "admin" as const, current: "approved" as const, action: "publish" as const };
    assert.deepEqual(check({ ...base, hasFutureLesson: true }), { ok: true, to: "upcoming" });
    assert.deepEqual(check({ ...base, hasFutureLesson: false }), { ok: true, to: "published" });
  });
  it("rejected is terminal", () => {
    for (const action of ["start_review", "approve", "publish", "request_changes"] as const) {
      const r = check({ actor: "admin", current: "rejected", action, reason: "abcdef", listPrice: 5000 });
      assert.equal(!r.ok && r.code, "INVALID_TRANSITION", action);
    }
  });
});

describe("lifecycle helpers", () => {
  it("teacher edits only draft / changes_requested", () => {
    const all: (CourseLifecycleStatus | null)[] = [
      null, "draft", "submitted", "in_review", "changes_requested", "rejected", "approved",
      "published", "upcoming", "active", "completed",
    ];
    assert.deepEqual(
      all.filter(isTeacherEditableLifecycle),
      ["draft", "changes_requested"],
    );
  });
  it("live only for legacy/published/upcoming/active", () => {
    assert.equal(isLiveAllowedForCourse(null), true);
    assert.equal(isLiveAllowedForCourse("upcoming"), true);
    assert.equal(isLiveAllowedForCourse("active"), true);
    assert.equal(isLiveAllowedForCourse("published"), true);
    for (const s of ["draft", "submitted", "in_review", "approved", "rejected", "completed"] as const) {
      assert.equal(isLiveAllowedForCourse(s), false, s);
    }
  });
  it("liveGate mirrors the live guard and says who moves next", () => {
    assert.equal(liveGate("draft", false), null);
    for (const s of [null, "published", "upcoming", "active"] as const) {
      assert.equal(liveGate(s, true), null, String(s));
    }
    assert.equal(liveGate("draft", true)?.canSubmit, true);
    assert.equal(liveGate("changes_requested", true)?.canSubmit, true);
    for (const s of ["submitted", "in_review", "approved", "rejected", "completed"] as const) {
      const gate = liveGate(s, true);
      assert.ok(gate, s);
      assert.equal(gate.canSubmit, false, s);
    }
  });
  it("lessonPlanLock freezes the plan from submit until publish (and after reject)", () => {
    for (const s of ["submitted", "in_review", "approved", "rejected"] as const) {
      assert.ok(lessonPlanLock(s, true), s);
      assert.equal(lessonPlanLock(s, false), null, `${s} flag off`);
    }
    for (const s of [null, "draft", "changes_requested", "published", "upcoming", "active"] as const) {
      assert.equal(lessonPlanLock(s, true), null, String(s));
    }
  });
  it("unpublish needs a reason and only from a live catalog status", () => {
    const denied = check({ action: "unpublish", actor: "admin", current: "published", reason: "yo" });
    assert.equal(denied.ok, false);
    const ok = check({
      action: "unpublish",
      actor: "admin",
      current: "active",
      reason: "O‘qituvchi darsni davom ettira olmaydi",
    });
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.to, "unpublished");
    const teacher = check({
      action: "unpublish",
      actor: "owner_teacher",
      current: "published",
      reason: "Sabab yetarli uzunlikda",
    });
    assert.equal(teacher.ok, false);
  });
  it("isPreAudienceLifecycle only for drafts under the review flow", () => {
    assert.equal(isPreAudienceLifecycle("draft", true), true);
    assert.equal(isPreAudienceLifecycle("changes_requested", true), true);
    assert.equal(isPreAudienceLifecycle("draft", false), false);
    for (const s of [null, "submitted", "approved", "published", "upcoming", "active"] as const) {
      assert.equal(isPreAudienceLifecycle(s, true), false, String(s));
    }
  });
});
