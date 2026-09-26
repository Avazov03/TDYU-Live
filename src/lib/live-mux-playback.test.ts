/**
 * Phase 8.5 — live Mux playback authorization (pure).
 *   npx tsx --test src/lib/live-mux-playback.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateEnrollmentLessonAccess } from "./enrollment-access";
import { evaluateLiveMuxPlayback, isRealMuxId } from "./live-mux-playback";

const COURSE = "course-a";
const OTHER = "course-b";
const PB = "playbackLive123";
const LS = "liveStream123";

function seat(courseId: string, overrides: { status?: "active" | "completed" | "refunded" | "cancelled"; accessOpen?: boolean } = {}) {
  return evaluateEnrollmentLessonAccess({
    userId: "u1",
    courseId: COURSE,
    lessonStatus: "live",
    enrollment: {
      id: "e1",
      courseId,
      status: overrides.status ?? "active",
      accessOpen: overrides.accessOpen ?? true,
    },
  });
}

const base = {
  userId: "u1" as string | undefined,
  staff: false,
  lessonStatus: "live",
  sessionLive: null as boolean | null,
  playbackId: PB as string | null,
  liveStreamId: LS as string | null,
};

describe("evaluateLiveMuxPlayback", () => {
  it("A: anonymous is denied", () => {
    const d = evaluateLiveMuxPlayback({ ...base, userId: undefined, enrollment: null });
    assert.deepEqual(d, { ok: false, reason: "unauthenticated" });
  });

  it("B: authenticated without enrollment is denied", () => {
    const enr = evaluateEnrollmentLessonAccess({ userId: "u1", courseId: COURSE, lessonStatus: "live", enrollment: null });
    assert.deepEqual(evaluateLiveMuxPlayback({ ...base, enrollment: enr }), { ok: false, reason: "not_enrolled" });
  });

  it("H: enrollment in another course is denied", () => {
    assert.deepEqual(evaluateLiveMuxPlayback({ ...base, enrollment: seat(OTHER) }), { ok: false, reason: "not_enrolled" });
  });

  it("closed or refunded enrollment is denied", () => {
    assert.equal(evaluateLiveMuxPlayback({ ...base, enrollment: seat(COURSE, { accessOpen: false }) }).ok, false);
    assert.equal(evaluateLiveMuxPlayback({ ...base, enrollment: seat(COURSE, { status: "refunded" }) }).ok, false);
  });

  it("C: enrolled student on a live lesson gets only the playback id", () => {
    const d = evaluateLiveMuxPlayback({ ...base, enrollment: seat(COURSE) });
    assert.deepEqual(d, { ok: true, playbackId: PB, liveStreamId: LS, viewer: "student" });
  });

  it("completed enrollment keeps live access", () => {
    assert.equal(evaluateLiveMuxPlayback({ ...base, enrollment: seat(COURSE, { status: "completed" }) }).ok, true);
  });

  it("D: lesson not live (scheduled/lobby/ended) is not_live", () => {
    for (const lessonStatus of ["scheduled", "lobby", "waiting_room", "ended"]) {
      const d = evaluateLiveMuxPlayback({ ...base, lessonStatus, enrollment: seat(COURSE) });
      assert.deepEqual(d, { ok: false, reason: "not_live" }, lessonStatus);
    }
  });

  it("enrolled student on a scheduled lesson is not_live (not not_enrolled)", () => {
    const enr = evaluateEnrollmentLessonAccess({
      userId: "u1",
      courseId: COURSE,
      lessonStatus: "scheduled",
      enrollment: { id: "e1", courseId: COURSE, status: "active", accessOpen: true },
    });
    const d = evaluateLiveMuxPlayback({ ...base, lessonStatus: "scheduled", enrollment: enr });
    assert.deepEqual(d, { ok: false, reason: "not_live" });
    const none = evaluateEnrollmentLessonAccess({ userId: "u1", courseId: COURSE, lessonStatus: "scheduled", enrollment: null });
    assert.deepEqual(evaluateLiveMuxPlayback({ ...base, lessonStatus: "scheduled", enrollment: none }), { ok: false, reason: "not_enrolled" });
  });

  it("LiveSession not live (flag on) is not_live even if Lesson says live", () => {
    const d = evaluateLiveMuxPlayback({ ...base, sessionLive: false, enrollment: seat(COURSE) });
    assert.deepEqual(d, { ok: false, reason: "not_live" });
  });

  it("missing or demo playback never renders a player", () => {
    for (const [playbackId, liveStreamId] of [[null, LS], ["demo_play_x", LS], [PB, null], [PB, "demo_live_x"]]) {
      const d = evaluateLiveMuxPlayback({ ...base, playbackId, liveStreamId, enrollment: seat(COURSE) });
      assert.deepEqual(d, { ok: false, reason: "no_playback" });
    }
  });

  it("owner teacher / admin preview is allowed without enrollment", () => {
    const d = evaluateLiveMuxPlayback({ ...base, staff: true, enrollment: null });
    assert.deepEqual(d, { ok: true, playbackId: PB, liveStreamId: LS, viewer: "staff" });
  });

  it("tier is irrelevant: seat access ignores legacy live tier", () => {
    const enr = evaluateEnrollmentLessonAccess({
      userId: "u1",
      courseId: COURSE,
      lessonStatus: "live",
      enrollment: { id: "e1", courseId: COURSE, status: "active", accessOpen: true },
      legacyTier: "t1",
    });
    assert.equal(evaluateLiveMuxPlayback({ ...base, enrollment: enr }).ok, true);
  });

  it("isRealMuxId", () => {
    assert.equal(isRealMuxId("abc"), true);
    assert.equal(isRealMuxId("demo_x"), false);
    assert.equal(isRealMuxId(null), false);
  });
});
