import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  advanceTeachingClock,
  DISCONNECT_GAP_SEC,
  setManualPause,
  TEACHING_LIMIT_SEC,
} from "./live-teaching-clock";

const t0 = new Date("2026-10-06T10:00:00.000Z");

function base(over: Partial<Parameters<typeof advanceTeachingClock>[0]> = {}) {
  return {
    status: "live" as const,
    activeTeachingSeconds: 0,
    pauseSeconds: 0,
    lastTeacherBeatAt: t0,
    manualPause: false,
    now: new Date(t0.getTime() + 5_000),
    actor: "teacher" as const,
    warn55Sent: false,
    warn58Sent: false,
    warn59Sent: false,
    ...over,
  };
}

describe("teaching clock", () => {
  it("adds only the teacher gap while live", () => {
    const r = advanceTeachingClock(base());
    assert.equal(r.activeTeachingSeconds, 5);
    assert.equal(r.pauseSeconds, 0);
    assert.equal(r.status, "live");
  });

  it("does not count a disconnect gap as teaching", () => {
    const r = advanceTeachingClock(
      base({ now: new Date(t0.getTime() + (DISCONNECT_GAP_SEC + 15) * 1000) }),
    );
    assert.equal(r.activeTeachingSeconds, 0);
    assert.equal(r.pauseSeconds, DISCONNECT_GAP_SEC + 15);
    assert.equal(r.status, "live");
  });

  it("observer pauses the session when the teacher beat is stale", () => {
    const r = advanceTeachingClock(
      base({
        actor: "observer",
        now: new Date(t0.getTime() + (DISCONNECT_GAP_SEC + 5) * 1000),
      }),
    );
    assert.equal(r.status, "paused");
    assert.equal(r.activeTeachingSeconds, 0);
    assert.equal(r.manualPause, false);
  });

  it("manual pause excludes the following gap from teaching", () => {
    const paused = setManualPause(base({ activeTeachingSeconds: 100 }), true);
    assert.equal(paused.status, "paused");
    assert.equal(paused.manualPause, true);
    const later = advanceTeachingClock({
      ...base(),
      status: "paused",
      manualPause: true,
      activeTeachingSeconds: paused.activeTeachingSeconds,
      pauseSeconds: paused.pauseSeconds,
      lastTeacherBeatAt: paused.lastTeacherBeatAt,
      now: new Date((paused.lastTeacherBeatAt ?? t0).getTime() + 30_000),
    });
    assert.equal(later.activeTeachingSeconds, paused.activeTeachingSeconds);
    assert.ok(later.pauseSeconds > paused.pauseSeconds);
  });

  it("fires 55 then auto-ends at 60 minutes", () => {
    const warn = advanceTeachingClock(
      base({
        activeTeachingSeconds: 55 * 60 - 2,
        now: new Date(t0.getTime() + 5_000),
      }),
    );
    assert.equal(warn.warning, 55);
    assert.equal(warn.autoEnd, false);
    const end = advanceTeachingClock(
      base({
        activeTeachingSeconds: TEACHING_LIMIT_SEC - 3,
        now: new Date(t0.getTime() + 5_000),
      }),
    );
    assert.equal(end.autoEnd, true);
    assert.equal(end.status, "ended");
    assert.equal(end.activeTeachingSeconds, TEACHING_LIMIT_SEC);
  });
});
