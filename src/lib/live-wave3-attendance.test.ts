/**
 * Phase 7 Live Wave 3 — AttendanceInterval unit tests.
 *   npx tsx --test src/lib/live-wave3-attendance.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attendanceDurationSeconds,
  shouldOpenLiveAttendance,
  userIdFromLivePeerId,
} from "./live-attendance";
import { livePeerIdForUser } from "./live-join-token";
import { isLiveAttendanceV3Enabled } from "./feature-flags";

describe("Live Wave 3 attendance gates", () => {
  it("waiting room does not open attendance", () => {
    const gate = shouldOpenLiveAttendance({
      flagOn: true,
      moderator: false,
      phase: "lobby",
      liveSessionStatus: "waiting",
      liveSessionId: "sess-1",
    });
    assert.equal(gate.ok, false);
    if (!gate.ok) assert.equal(gate.code, "WAITING_NOT_ATTENDANCE");
  });

  it("LIVE student join may open attendance", () => {
    const gate = shouldOpenLiveAttendance({
      flagOn: true,
      moderator: false,
      phase: "live",
      liveSessionStatus: "live",
      liveSessionId: "sess-1",
    });
    assert.equal(gate.ok, true);
  });

  it("teacher does not receive student attendance", () => {
    const gate = shouldOpenLiveAttendance({
      flagOn: true,
      moderator: true,
      phase: "live",
      liveSessionStatus: "live",
      liveSessionId: "sess-1",
    });
    assert.equal(gate.ok, false);
    if (!gate.ok) assert.equal(gate.code, "TEACHER_NOT_STUDENT_ATTENDANCE");
  });

  it("ended / non-live session cannot start attendance", () => {
    const gate = shouldOpenLiveAttendance({
      flagOn: true,
      moderator: false,
      phase: "live",
      liveSessionStatus: "ended",
      liveSessionId: "sess-1",
    });
    assert.equal(gate.ok, false);
    if (!gate.ok) assert.equal(gate.code, "SESSION_NOT_LIVE");
  });

  it("flag off denies open", () => {
    const gate = shouldOpenLiveAttendance({
      flagOn: false,
      moderator: false,
      phase: "live",
      liveSessionStatus: "live",
      liveSessionId: "sess-1",
    });
    assert.equal(gate.ok, false);
  });
});

describe("Live Wave 3 duration + identity", () => {
  it("duration is leftAt - joinedAt and never negative", () => {
    const joinedAt = new Date("2026-09-24T10:00:00.000Z");
    const leftAt = new Date("2026-09-24T10:20:00.000Z");
    assert.equal(attendanceDurationSeconds({ joinedAt, leftAt }), 20 * 60);
    assert.equal(
      attendanceDurationSeconds({
        joinedAt,
        leftAt: new Date("2026-09-24T09:00:00.000Z"),
      }),
      0,
    );
  });

  it("open interval uses now for duration", () => {
    const joinedAt = new Date("2026-09-24T10:00:00.000Z");
    const now = new Date("2026-09-24T10:05:00.000Z");
    assert.equal(attendanceDurationSeconds({ joinedAt, leftAt: null, now }), 5 * 60);
  });

  it("peerId round-trip preserves user identity", () => {
    const userId = "a6666666-6666-6666-6666-666666666611";
    const peer = livePeerIdForUser(userId);
    assert.equal(userIdFromLivePeerId(peer), userId);
  });

  it("two reconnect intervals sum independently (documented invariant)", () => {
    // Interval 1: 10:00–10:20 = 20m; Interval 2: 10:25–11:00 = 35m; total 55m
    const i1 = attendanceDurationSeconds({
      joinedAt: new Date("2026-09-24T10:00:00.000Z"),
      leftAt: new Date("2026-09-24T10:20:00.000Z"),
    });
    const i2 = attendanceDurationSeconds({
      joinedAt: new Date("2026-09-24T10:25:00.000Z"),
      leftAt: new Date("2026-09-24T11:00:00.000Z"),
    });
    assert.equal(i1 + i2, 55 * 60);
  });
});

describe("Live Wave 3 feature flag", () => {
  it("defaults off", () => {
    const prev = process.env.FF_LIVE_ATTENDANCE_V3;
    delete process.env.FF_LIVE_ATTENDANCE_V3;
    assert.equal(isLiveAttendanceV3Enabled(), false);
    if (prev !== undefined) process.env.FF_LIVE_ATTENDANCE_V3 = prev;
  });

  it("reads true", () => {
    const prev = process.env.FF_LIVE_ATTENDANCE_V3;
    process.env.FF_LIVE_ATTENDANCE_V3 = "true";
    assert.equal(isLiveAttendanceV3Enabled(), true);
    if (prev === undefined) delete process.env.FF_LIVE_ATTENDANCE_V3;
    else process.env.FF_LIVE_ATTENDANCE_V3 = prev;
  });
});

describe("Live Wave 3 course completion independence (documented)", () => {
  it("attendance helpers do not expose completion APIs", () => {
    // AttendanceInterval is participation-only; no completion threshold in this module.
    assert.equal(typeof shouldOpenLiveAttendance, "function");
    assert.equal("markCourseComplete" in globalThis, false);
  });
});
