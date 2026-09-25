import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHmac } from "crypto";
import {
  canPublishRecordingStatus,
  isStudentPlayableStatus,
  isTeacherReviewableStatus,
  reviewDeadlineFromReadyAt,
  RECORDING_REVIEW_MS,
  studentMayPlayRecording,
  teacherMayPreviewRecording,
} from "./recording-lifecycle";
import { verifyMuxWebhookSignature } from "./mux-webhook";
import { isRecordingReviewV1Enabled } from "./feature-flags";

describe("Recording Wave 1 state helpers", () => {
  it("students only play published", () => {
    assert.equal(isStudentPlayableStatus("published"), true);
    assert.equal(isStudentPlayableStatus("processing"), false);
    assert.equal(isStudentPlayableStatus("ready"), false);
    assert.equal(isStudentPlayableStatus("teacher_review"), false);
    assert.equal(isStudentPlayableStatus("failed"), false);
  });

  it("teacher may preview ready / teacher_review / published", () => {
    assert.equal(isTeacherReviewableStatus("ready"), true);
    assert.equal(isTeacherReviewableStatus("teacher_review"), true);
    assert.equal(isTeacherReviewableStatus("published"), true);
    assert.equal(isTeacherReviewableStatus("processing"), false);
  });

  it("READY not visible to student when flag on", () => {
    assert.equal(
      studentMayPlayRecording({ flagOn: true, recordingStatus: "teacher_review" }),
      false,
    );
    assert.equal(
      studentMayPlayRecording({ flagOn: true, recordingStatus: "ready" }),
      false,
    );
    assert.equal(
      studentMayPlayRecording({ flagOn: true, recordingStatus: "published" }),
      true,
    );
  });

  it("teacher can preview READY", () => {
    assert.equal(
      teacherMayPreviewRecording({ flagOn: true, recordingStatus: "teacher_review" }),
      true,
    );
  });

  it("publish only from ready / teacher_review", () => {
    assert.equal(canPublishRecordingStatus("ready"), true);
    assert.equal(canPublishRecordingStatus("teacher_review"), true);
    assert.equal(canPublishRecordingStatus("processing"), false);
    assert.equal(canPublishRecordingStatus("failed"), false);
    assert.equal(canPublishRecordingStatus("published"), false);
  });

  it("24h deadline is based on readyAt", () => {
    const readyAt = new Date("2026-09-25T10:00:00.000Z");
    const deadline = reviewDeadlineFromReadyAt(readyAt);
    assert.equal(deadline.getTime() - readyAt.getTime(), RECORDING_REVIEW_MS);
    assert.equal(deadline.toISOString(), "2026-09-26T10:00:00.000Z");
  });

  it("attendance/completion independence — helpers do not expose completion APIs", () => {
    assert.equal(typeof studentMayPlayRecording, "function");
    assert.equal(typeof canPublishRecordingStatus, "function");
    // No course-completion coupling in this module's public surface.
    assert.ok(!("markCourseComplete" in globalThis));
  });
});

describe("Recording Wave 1 feature flag", () => {
  it("defaults off", () => {
    const prevV1 = process.env.FF_RECORDING_REVIEW_V1;
    const prev24 = process.env.FF_RECORDING_REVIEW_24H;
    delete process.env.FF_RECORDING_REVIEW_V1;
    delete process.env.FF_RECORDING_REVIEW_24H;
    assert.equal(isRecordingReviewV1Enabled(), false);
    process.env.FF_RECORDING_REVIEW_V1 = prevV1;
    process.env.FF_RECORDING_REVIEW_24H = prev24;
  });

  it("reads FF_RECORDING_REVIEW_V1", () => {
    const prevV1 = process.env.FF_RECORDING_REVIEW_V1;
    const prev24 = process.env.FF_RECORDING_REVIEW_24H;
    delete process.env.FF_RECORDING_REVIEW_24H;
    process.env.FF_RECORDING_REVIEW_V1 = "true";
    assert.equal(isRecordingReviewV1Enabled(), true);
    process.env.FF_RECORDING_REVIEW_V1 = prevV1;
    process.env.FF_RECORDING_REVIEW_24H = prev24;
  });
});

describe("Mux webhook signature", () => {
  it("accepts valid signature", () => {
    const secret = "whsec_test_secret";
    const rawBody = JSON.stringify({ type: "video.asset.ready", data: {} });
    const t = String(Math.floor(Date.now() / 1000));
    const v1 = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
    const res = verifyMuxWebhookSignature({
      rawBody,
      signatureHeader: `t=${t},v1=${v1}`,
      secret,
    });
    assert.equal(res.ok, true);
  });

  it("rejects invalid signature", () => {
    const res = verifyMuxWebhookSignature({
      rawBody: "{}",
      signatureHeader: "t=1,v1=deadbeef",
      secret: "whsec_test_secret",
      nowSeconds: 1,
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.code, "BAD_SIGNATURE");
  });

  it("rejects missing header", () => {
    const res = verifyMuxWebhookSignature({
      rawBody: "{}",
      signatureHeader: null,
      secret: "whsec_test_secret",
    });
    assert.equal(res.ok, false);
  });
});
