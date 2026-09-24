/**
 * Phase 7 Live Wave 2 — A/V permission policy unit tests.
 *   npx tsx --test src/lib/live-wave2-av.test.ts
 */

import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  applyGrant,
  applyRaiseHand,
  applyRevoke,
  applyTeacherCameraOff,
  applyTeacherMute,
  clampStudentPublishState,
  initialStudentAvFlags,
  studentMayPublishCam,
  studentMayPublishMic,
} from "./live-av-policy";
import {
  __resetLiveRoomsForTests,
  applyAvControl,
  applyRoomEvent,
  joinLivePeer,
  pollLiveRoom,
} from "./live-rooms";
import { isLiveAvPolicyV2Enabled } from "./feature-flags";

describe("Live Wave 2 A/V policy helpers", () => {
  it("student defaults camera and mic OFF", () => {
    const f = initialStudentAvFlags();
    assert.equal(f.micOn, false);
    assert.equal(f.camOn, false);
    assert.equal(f.avPermission, "none");
    assert.equal(studentMayPublishMic(f), false);
    assert.equal(studentMayPublishCam(f), false);
  });

  it("raise hand → REQUESTED without publishing", () => {
    const f = applyRaiseHand(initialStudentAvFlags(), true);
    assert.equal(f.avPermission, "requested");
    assert.equal(f.handRaised, true);
    assert.equal(f.canSpeak, false);
    assert.equal(f.micOn, false);
  });

  it("grant does not auto-enable mic/cam", () => {
    const requested = applyRaiseHand(initialStudentAvFlags(), true);
    const granted = applyGrant(requested, { mic: true, cam: true });
    assert.equal(granted.avPermission, "granted");
    assert.equal(granted.canSpeak, true);
    assert.equal(granted.allowCam, true);
    assert.equal(granted.micOn, false);
    assert.equal(granted.camOn, false);
    assert.equal(granted.handRaised, false);
  });

  it("student can publish only after grant and without teacher mute", () => {
    let f = applyGrant(initialStudentAvFlags(), { mic: true, cam: true });
    assert.equal(studentMayPublishMic(f), true);
    assert.equal(studentMayPublishCam(f), true);
    f = applyTeacherMute(f);
    assert.equal(studentMayPublishMic(f), false);
    assert.equal(studentMayPublishCam(f), true);
    f = applyTeacherCameraOff(f);
    assert.equal(studentMayPublishCam(f), false);
  });

  it("revoke disables publish and requires new request", () => {
    let f = applyGrant(initialStudentAvFlags(), { mic: true, cam: true });
    f = { ...f, micOn: true, camOn: true };
    f = applyRevoke(f);
    assert.equal(f.avPermission, "revoked");
    assert.equal(f.micOn, false);
    assert.equal(f.camOn, false);
    assert.equal(studentMayPublishMic(f), false);
    const clamped = clampStudentPublishState(f, { micOn: true, camOn: true }, false);
    assert.deepEqual(clamped, { micOn: false, camOn: false });
  });

  it("clamp rejects student forge of publish state", () => {
    const f = initialStudentAvFlags();
    const clamped = clampStudentPublishState(f, { micOn: true, camOn: true }, false);
    assert.deepEqual(clamped, { micOn: false, camOn: false });
  });
});

describe("Live Wave 2 room A/V controls", () => {
  const lessonId = "lesson-wave2-av";

  beforeEach(() => {
    __resetLiveRoomsForTests();
  });

  it("independent permissions for multiple students", () => {
    joinLivePeer(lessonId, "u_teacher", "Teacher", "moderator");
    joinLivePeer(lessonId, "u_a", "Alice", "student");
    joinLivePeer(lessonId, "u_b", "Bob", "student");
    joinLivePeer(lessonId, "u_c", "Carol", "student");

    assert.equal(applyAvControl({ lessonId, actorPeerId: "u_teacher", action: "grant", targetPeerId: "u_a" }).ok, true);
    assert.equal(applyAvControl({ lessonId, actorPeerId: "u_teacher", action: "revoke", targetPeerId: "u_c" }).ok, true);

    const a = pollLiveRoom(lessonId, "u_a", 0).self!;
    const b = pollLiveRoom(lessonId, "u_b", 0).self!;
    const c = pollLiveRoom(lessonId, "u_c", 0).self!;
    assert.equal(a.avPermission, "granted");
    assert.equal(b.avPermission, "none");
    assert.equal(c.avPermission, "revoked");
  });

  it("student cannot grant themselves or another student", () => {
    joinLivePeer(lessonId, "u_teacher", "Teacher", "moderator");
    joinLivePeer(lessonId, "u_a", "Alice", "student");
    joinLivePeer(lessonId, "u_b", "Bob", "student");

    const selfGrant = applyAvControl({
      lessonId,
      actorPeerId: "u_a",
      action: "grant",
      targetPeerId: "u_a",
    });
    assert.equal(selfGrant.ok, false);
    if (!selfGrant.ok) assert.equal(selfGrant.code, "NOT_MODERATOR");

    const otherGrant = applyAvControl({
      lessonId,
      actorPeerId: "u_a",
      action: "grant",
      targetPeerId: "u_b",
    });
    assert.equal(otherGrant.ok, false);

    // Signal path also rejects non-moderator grant (no state change).
    const snap = applyRoomEvent(lessonId, "u_a", {
      kind: "grant",
      targetId: "u_b",
      mic: true,
      cam: true,
    });
    const b = snap.peers.find((p) => p.id === "u_b") || pollLiveRoom(lessonId, "u_b", 0).self;
    assert.equal(b?.avPermission, "none");
    assert.equal(b?.canSpeak, false);
  });

  it("raise hand → teacher grant → student state clamp until granted", () => {
    joinLivePeer(lessonId, "u_teacher", "Teacher", "moderator");
    joinLivePeer(lessonId, "u_a", "Alice", "student");

    assert.equal(
      applyAvControl({ lessonId, actorPeerId: "u_a", action: "raise_hand" }).ok,
      true,
    );
    let self = pollLiveRoom(lessonId, "u_a", 0).self!;
    assert.equal(self.avPermission, "requested");
    assert.equal(self.handRaised, true);

    // Before grant, forged state is clamped.
    applyRoomEvent(lessonId, "u_a", { kind: "state", micOn: true, camOn: true });
    self = pollLiveRoom(lessonId, "u_a", 0).self!;
    assert.equal(self.micOn, false);
    assert.equal(self.camOn, false);

    assert.equal(
      applyAvControl({
        lessonId,
        actorPeerId: "u_teacher",
        action: "grant",
        targetPeerId: "u_a",
        mic: true,
        cam: true,
      }).ok,
      true,
    );
    self = pollLiveRoom(lessonId, "u_a", 0).self!;
    assert.equal(self.avPermission, "granted");
    assert.equal(self.micOn, false); // grant ≠ auto-on
    assert.equal(self.handRaised, false);

    applyRoomEvent(lessonId, "u_a", { kind: "state", micOn: true, camOn: true });
    self = pollLiveRoom(lessonId, "u_a", 0).self!;
    assert.equal(self.micOn, true);
    assert.equal(self.camOn, true);

    assert.equal(
      applyAvControl({ lessonId, actorPeerId: "u_teacher", action: "revoke", targetPeerId: "u_a" })
        .ok,
      true,
    );
    applyRoomEvent(lessonId, "u_a", { kind: "state", micOn: true, camOn: true });
    self = pollLiveRoom(lessonId, "u_a", 0).self!;
    assert.equal(self.avPermission, "revoked");
    assert.equal(self.micOn, false);
    assert.equal(self.camOn, false);
  });

  it("teacher mute and camera-off force tracks off while distinguishable", () => {
    joinLivePeer(lessonId, "u_teacher", "Teacher", "moderator");
    joinLivePeer(lessonId, "u_a", "Alice", "student");
    applyAvControl({
      lessonId,
      actorPeerId: "u_teacher",
      action: "grant",
      targetPeerId: "u_a",
      mic: true,
      cam: true,
    });
    applyRoomEvent(lessonId, "u_a", { kind: "state", micOn: true, camOn: true });

    applyAvControl({ lessonId, actorPeerId: "u_teacher", action: "mute", targetPeerId: "u_a" });
    let self = pollLiveRoom(lessonId, "u_a", 0).self!;
    assert.equal(self.teacherMuted, true);
    assert.equal(self.canSpeak, true);
    assert.equal(self.micOn, false);
    applyRoomEvent(lessonId, "u_a", { kind: "state", micOn: true, camOn: true });
    self = pollLiveRoom(lessonId, "u_a", 0).self!;
    assert.equal(self.micOn, false);
    assert.equal(self.camOn, true);

    applyAvControl({
      lessonId,
      actorPeerId: "u_teacher",
      action: "camera_off",
      targetPeerId: "u_a",
    });
    applyRoomEvent(lessonId, "u_a", { kind: "state", micOn: true, camOn: true });
    self = pollLiveRoom(lessonId, "u_a", 0).self!;
    assert.equal(self.teacherCamOff, true);
    assert.equal(self.camOn, false);
  });
});

describe("Live Wave 2 feature flag", () => {
  it("defaults off", () => {
    const prev = process.env.FF_LIVE_AV_POLICY_V2;
    delete process.env.FF_LIVE_AV_POLICY_V2;
    assert.equal(isLiveAvPolicyV2Enabled(), false);
    if (prev !== undefined) process.env.FF_LIVE_AV_POLICY_V2 = prev;
  });
});
