import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  clearLiveJoinInstancesForTests,
  isStaleLiveLeave,
  markLiveJoinInstance,
} from "./live-join-instance";

const LESSON = "lesson-1";
const USER = "user-1";

describe("live join instance (reload / second tab leave race)", () => {
  beforeEach(() => clearLiveJoinInstancesForTests());

  it("leave from the current page is honoured", () => {
    markLiveJoinInstance(LESSON, USER, "page-a-instance");
    assert.equal(isStaleLiveLeave(LESSON, USER, "page-a-instance"), false);
  });

  it("leave from the unloaded page is ignored once the reloaded page joined", () => {
    markLiveJoinInstance(LESSON, USER, "page-a-instance");
    markLiveJoinInstance(LESSON, USER, "page-b-instance");
    assert.equal(isStaleLiveLeave(LESSON, USER, "page-a-instance"), true);
    assert.equal(isStaleLiveLeave(LESSON, USER, "page-b-instance"), false);
  });

  it("leave without an instance keeps the legacy behaviour", () => {
    markLiveJoinInstance(LESSON, USER, "page-b-instance");
    assert.equal(isStaleLiveLeave(LESSON, USER, undefined), false);
  });

  it("unknown state (e.g. after a restart) never drops a leave", () => {
    assert.equal(isStaleLiveLeave(LESSON, USER, "page-a-instance"), false);
  });

  it("instances are scoped per user and lesson", () => {
    markLiveJoinInstance(LESSON, USER, "page-b-instance");
    assert.equal(isStaleLiveLeave(LESSON, "user-2", "page-a-instance"), false);
    assert.equal(isStaleLiveLeave("lesson-2", USER, "page-a-instance"), false);
  });
});
