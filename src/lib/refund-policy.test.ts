import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  checkSpecialRefund,
  checkTeacherCancellation,
  courseProgressPercent,
  hasCourseStarted,
} from "./refund-policy";

const REASON = "Kasallik sababli, hujjat bor";

describe("courseProgressPercent", () => {
  it("counts taught lessons out of planned (non-cancelled) lessons", () => {
    assert.equal(courseProgressPercent(["published", "scheduled", "scheduled", "scheduled"]), 25);
    assert.equal(courseProgressPercent(["published", "ended", "scheduled", "cancelled"]), 66);
    assert.equal(courseProgressPercent(["published", "teacher_review"]), 100);
    assert.equal(courseProgressPercent([]), 0);
    assert.equal(courseProgressPercent(["cancelled"]), 0);
  });

  it("does not count a lesson that is waiting or live as taught", () => {
    assert.equal(courseProgressPercent(["live", "lobby"]), 0);
  });
});

describe("hasCourseStarted", () => {
  it("active/completed courses and any taught lesson mean started", () => {
    assert.equal(hasCourseStarted({ lifecycleStatus: "active", lessonStatuses: [] }), true);
    assert.equal(hasCourseStarted({ lifecycleStatus: "completed", lessonStatuses: [] }), true);
    assert.equal(hasCourseStarted({ lifecycleStatus: "upcoming", lessonStatuses: ["ended"] }), true);
    assert.equal(
      hasCourseStarted({ lifecycleStatus: "upcoming", lessonStatuses: ["scheduled", "cancelled"] }),
      false,
    );
  });
});

describe("checkTeacherCancellation — before start → 100%", () => {
  it("allows an upcoming/published/approved course with nothing taught", () => {
    for (const s of ["upcoming", "published", "approved"] as const) {
      assert.deepEqual(
        checkTeacherCancellation({ lifecycleStatus: s, lessonStatuses: ["scheduled"], reason: REASON }),
        { ok: true },
      );
    }
  });

  it("refuses once the course has started", () => {
    const active = checkTeacherCancellation({ lifecycleStatus: "active", lessonStatuses: [], reason: REASON });
    assert.equal(active.ok, false);
    if (!active.ok) assert.equal(active.code, "ALREADY_STARTED");
    const taught = checkTeacherCancellation({
      lifecycleStatus: "upcoming",
      lessonStatuses: ["published", "scheduled"],
      reason: REASON,
    });
    assert.equal(taught.ok, false);
    if (!taught.ok) assert.equal(taught.code, "ALREADY_STARTED");
  });

  it("refuses drafts, review states and already cancelled courses", () => {
    for (const s of ["draft", "submitted", "in_review", "rejected", "cancelled"] as const) {
      const r = checkTeacherCancellation({ lifecycleStatus: s, lessonStatuses: [], reason: REASON });
      assert.equal(r.ok, false, s);
      if (!r.ok) assert.equal(r.code, "INVALID_STATE");
    }
  });

  it("requires a reason for the students", () => {
    const r = checkTeacherCancellation({ lifecycleStatus: "upcoming", lessonStatuses: [], reason: "  " });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "VALIDATION");
  });
});

describe("checkSpecialRefund — admin 50% after start", () => {
  const base = { purchaseStatus: "completed" as const, amountPaid: 200_001, courseStarted: true, reason: REASON };

  it("issues half (rounded down) while progress < 50%", () => {
    assert.deepEqual(checkSpecialRefund({ ...base, progressPercent: 49 }), { ok: true, amount: 100_000 });
    assert.deepEqual(checkSpecialRefund({ ...base, progressPercent: 0 }), { ok: true, amount: 100_000 });
  });

  it("does not apply at 50% or more", () => {
    for (const p of [50, 75, 100]) {
      const r = checkSpecialRefund({ ...base, progressPercent: p });
      assert.equal(r.ok, false, String(p));
      if (!r.ok) assert.equal(r.code, "PROGRESS_TOO_HIGH");
    }
  });

  it("is not a substitute for the before-start 100% rule", () => {
    const r = checkSpecialRefund({ ...base, courseStarted: false, progressPercent: 0 });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "NOT_STARTED");
  });

  it("needs a justification and an unrefunded completed purchase", () => {
    const noReason = checkSpecialRefund({ ...base, progressPercent: 10, reason: "qisqa" });
    assert.equal(noReason.ok, false);
    if (!noReason.ok) assert.equal(noReason.code, "VALIDATION");
    for (const s of ["refunded", "partially_refunded", "pending", "failed"] as const) {
      const r = checkSpecialRefund({ ...base, purchaseStatus: s, progressPercent: 10 });
      assert.equal(r.ok, false, s);
      if (!r.ok) assert.equal(r.code, "NOT_REFUNDABLE");
    }
  });
});
