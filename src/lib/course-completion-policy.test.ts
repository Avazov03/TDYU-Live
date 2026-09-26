import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkCourseCompletion } from "./course-completion-policy";

describe("checkCourseCompletion", () => {
  it("allows an active course whose lessons are all taught or cancelled", () => {
    const r = checkCourseCompletion({
      lifecycleStatus: "active",
      lessonStatuses: ["published", "ended", "teacher_review", "cancelled"],
    });
    assert.deepEqual(r, { ok: true });
  });

  it("allows an active course with no lessons left at all", () => {
    assert.equal(checkCourseCompletion({ lifecycleStatus: "active", lessonStatuses: [] }).ok, true);
  });

  it("blocks while any lesson is scheduled, waiting or live", () => {
    for (const open of ["scheduled", "lobby", "waiting_room", "live", "paused"] as const) {
      const r = checkCourseCompletion({ lifecycleStatus: "active", lessonStatuses: ["published", open] });
      assert.equal(r.ok, false, open);
      if (!r.ok) {
        assert.equal(r.code, "OPEN_LESSONS");
        assert.match(r.message, /1 ta/);
      }
    }
  });

  it("only an active course can be completed", () => {
    for (const s of ["draft", "in_review", "approved", "published", "upcoming", "completed", "cancelled"] as const) {
      const r = checkCourseCompletion({ lifecycleStatus: s, lessonStatuses: ["published"] });
      assert.equal(r.ok, false, s);
      if (!r.ok) assert.equal(r.code, "INVALID_STATE");
    }
    assert.equal(checkCourseCompletion({ lifecycleStatus: null, lessonStatuses: [] }).ok, false);
  });
});
