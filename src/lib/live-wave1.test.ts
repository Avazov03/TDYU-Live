/**
 * Phase 7 Live Wave 1 — pure unit tests.
 *   npx tsx --test src/lib/live-wave1.test.ts
 */

import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import {
  canTeacherEndLive,
  canTeacherOpenWaiting,
  canTeacherStartLive,
  isJoinableLiveLessonStatus,
  isWaitingLessonStatus,
  mapLessonToSessionIntent,
} from "./live-session";
import {
  issueLiveJoinToken,
  livePeerIdForUser,
  verifyLiveJoinToken,
} from "./live-join-token";
import { isLiveWaitingRoomV2Enabled } from "./feature-flags";

describe("Live Wave 1 lifecycle mapping", () => {
  it("waiting lesson statuses", () => {
    assert.equal(isWaitingLessonStatus("lobby"), true);
    assert.equal(isWaitingLessonStatus("waiting_room"), true);
    assert.equal(isWaitingLessonStatus("live"), false);
  });

  it("joinable when waiting or live", () => {
    assert.equal(isJoinableLiveLessonStatus("lobby"), true);
    assert.equal(isJoinableLiveLessonStatus("live"), true);
    assert.equal(isJoinableLiveLessonStatus("ended"), false);
    assert.equal(isJoinableLiveLessonStatus("cancelled"), false);
  });

  it("cancelled maps to deny", () => {
    assert.equal(mapLessonToSessionIntent("cancelled"), "deny");
  });

  it("teacher open/start/end guards", () => {
    assert.equal(canTeacherOpenWaiting("scheduled"), true);
    assert.equal(canTeacherOpenWaiting("cancelled"), false);
    assert.equal(canTeacherStartLive("lobby"), true);
    assert.equal(canTeacherStartLive("ended"), false);
    assert.equal(canTeacherEndLive("live"), true);
    assert.equal(canTeacherEndLive("scheduled"), false);
  });
});

describe("Live Wave 1 join token", () => {
  const prev = process.env.NEXTAUTH_SECRET;
  before(() => {
    process.env.NEXTAUTH_SECRET = "wave1-test-secret-not-for-prod";
  });
  after(() => {
    if (prev === undefined) delete process.env.NEXTAUTH_SECRET;
    else process.env.NEXTAUTH_SECRET = prev;
  });

  it("issues and verifies token tied to user/lesson/session", () => {
    const token = issueLiveJoinToken({
      userId: "user-a",
      lessonId: "lesson-a",
      liveSessionId: "session-a",
      nowSec: 1_000_000,
    });
    const ok = verifyLiveJoinToken(
      token,
      { userId: "user-a", lessonId: "lesson-a", liveSessionId: "session-a" },
      1_000_010,
    );
    assert.equal(ok.ok, true);
  });

  it("rejects expired / wrong user / wrong lesson", () => {
    const token = issueLiveJoinToken({
      userId: "user-a",
      lessonId: "lesson-a",
      liveSessionId: "session-a",
      nowSec: 1_000_000,
      ttlSec: 10,
    });
    assert.equal(
      verifyLiveJoinToken(token, { userId: "user-a", lessonId: "lesson-a" }, 1_000_020).ok,
      false,
    );
    assert.equal(
      verifyLiveJoinToken(token, { userId: "user-b", lessonId: "lesson-a" }, 1_000_005).ok,
      false,
    );
    assert.equal(
      verifyLiveJoinToken(token, { userId: "user-a", lessonId: "lesson-b" }, 1_000_005).ok,
      false,
    );
  });

  it("peer id is bound to user (not random client id)", () => {
    const a = livePeerIdForUser("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    const b = livePeerIdForUser("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    const c = livePeerIdForUser("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.match(a, /^u_/);
  });
});

describe("Live Wave 1 feature flag", () => {
  it("defaults off", () => {
    const prev = process.env.FF_LIVE_WAITING_ROOM_V2;
    delete process.env.FF_LIVE_WAITING_ROOM_V2;
    assert.equal(isLiveWaitingRoomV2Enabled(), false);
    if (prev !== undefined) process.env.FF_LIVE_WAITING_ROOM_V2 = prev;
  });

  it("reads true", () => {
    const prev = process.env.FF_LIVE_WAITING_ROOM_V2;
    process.env.FF_LIVE_WAITING_ROOM_V2 = "true";
    assert.equal(isLiveWaitingRoomV2Enabled(), true);
    if (prev === undefined) delete process.env.FF_LIVE_WAITING_ROOM_V2;
    else process.env.FF_LIVE_WAITING_ROOM_V2 = prev;
  });
});

describe("Live Wave 1 attendance invariant (documented)", () => {
  it("waiting presence must not equal attendance (policy)", () => {
    // Enforced in learn/[id]/page.tsx when FF_LIVE_WAITING_ROOM_V2:
    // attendance only for live|ended — not lobby/waiting_room.
    assert.equal(isWaitingLessonStatus("lobby"), true);
    assert.equal(isJoinableLiveLessonStatus("lobby"), true);
  });
});
