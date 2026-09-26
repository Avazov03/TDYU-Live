/**
 * Phase 8.5 — replay source never falls back to the live stream playback ID.
 *   npx tsx --test src/lib/recording-replay-source.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveReplayPlaybackId, shouldMarkRecordingReadyOnUpload } from "./recording-lifecycle";

describe("resolveReplayPlaybackId", () => {
  it("returns nothing while the lesson is live", () => {
    assert.equal(
      resolveReplayPlaybackId({ lessonStatus: "live", recordingPlaybackId: "rec", lessonVodPlaybackId: "vod" }),
      null,
    );
  });

  it("ended lesson without a recording has no replay source", () => {
    for (const lessonStatus of ["ended", "recording_processing", "recording_ready", "teacher_review", "published"]) {
      assert.equal(
        resolveReplayPlaybackId({ lessonStatus, recordingPlaybackId: null, lessonVodPlaybackId: null }),
        null,
      );
    }
  });

  it("prefers the Recording row, then the lesson VOD column", () => {
    assert.equal(
      resolveReplayPlaybackId({ lessonStatus: "ended", recordingPlaybackId: "rec", lessonVodPlaybackId: "vod" }),
      "rec",
    );
    assert.equal(
      resolveReplayPlaybackId({ lessonStatus: "ended", recordingPlaybackId: null, lessonVodPlaybackId: "vod" }),
      "vod",
    );
  });

  it("does not accept a live playback ID input at all", () => {
    const input = { lessonStatus: "ended", recordingPlaybackId: null, lessonVodPlaybackId: null, muxLivePlaybackId: "live" };
    assert.equal(resolveReplayPlaybackId(input), null);
  });
});

describe("shouldMarkRecordingReadyOnUpload", () => {
  it("interim uploads during live/waiting never move the lesson into review", () => {
    for (const lessonStatus of ["live", "lobby", "waiting_room"]) {
      assert.equal(shouldMarkRecordingReadyOnUpload({ reviewFlagOn: true, lessonStatus }), false, lessonStatus);
    }
  });

  it("uploads after the lesson ended still mark the recording ready", () => {
    for (const lessonStatus of ["ended", "recording_processing", "teacher_review"]) {
      assert.equal(shouldMarkRecordingReadyOnUpload({ reviewFlagOn: true, lessonStatus }), true, lessonStatus);
    }
  });

  it("review flag off keeps legacy behaviour", () => {
    assert.equal(shouldMarkRecordingReadyOnUpload({ reviewFlagOn: false, lessonStatus: "ended" }), false);
  });
});
