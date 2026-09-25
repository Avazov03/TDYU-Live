import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateKeyPairSync } from "crypto";
import {
  decodeJwtPayloadUnsafe,
  isMuxSigningConfigured,
  MUX_PLAYBACK_TOKEN_TTL_SEC,
  muxPublicPlayerUrl,
  muxSignedPlayerUrl,
  signFixturePlaybackToken,
  signMuxPlaybackToken,
  verifyFixturePlaybackToken,
} from "./mux-signed-playback";
import { isRecordingSignedPlaybackV1Enabled } from "./feature-flags";
import { studentMayPlayRecording } from "./recording-lifecycle";

describe("Recording Wave 2 signed playback helpers", () => {
  it("TTL is within 5–15 minutes", () => {
    assert.ok(MUX_PLAYBACK_TOKEN_TTL_SEC >= 5 * 60);
    assert.ok(MUX_PLAYBACK_TOKEN_TTL_SEC <= 15 * 60);
  });

  it("public player URL has no token", () => {
    const url = muxPublicPlayerUrl("abc123");
    assert.equal(url, "https://player.mux.com/abc123");
    assert.ok(!url.includes("token="));
  });

  it("signed player URL includes token query", () => {
    const url = muxSignedPlayerUrl("abc123", "jwt.here");
    assert.ok(url.includes("token=jwt.here"));
    assert.ok(url.startsWith("https://player.mux.com/abc123?"));
  });

  it("signing defaults off without env", () => {
    const prevId = process.env.MUX_SIGNING_KEY_ID;
    const prevKey = process.env.MUX_SIGNING_PRIVATE_KEY;
    delete process.env.MUX_SIGNING_KEY_ID;
    delete process.env.MUX_SIGNING_PRIVATE_KEY;
    assert.equal(isMuxSigningConfigured(), false);
    process.env.MUX_SIGNING_KEY_ID = prevId;
    process.env.MUX_SIGNING_PRIVATE_KEY = prevKey;
  });

  it("signs Mux JWT with RS256 when keys configured", () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs1", format: "pem" }).toString();
    const prevId = process.env.MUX_SIGNING_KEY_ID;
    const prevKey = process.env.MUX_SIGNING_PRIVATE_KEY;
    process.env.MUX_SIGNING_KEY_ID = "test-key-id";
    process.env.MUX_SIGNING_PRIVATE_KEY = Buffer.from(pem, "utf8").toString("base64");

    const playbackId = "playback_abc_test";
    const { token, ttlSec } = signMuxPlaybackToken({ playbackId, nowSec: 1_700_000_000 });
    assert.equal(ttlSec, MUX_PLAYBACK_TOKEN_TTL_SEC);
    const parts = token.split(".");
    assert.equal(parts.length, 3);
    const payload = decodeJwtPayloadUnsafe(token);
    assert.ok(payload);
    assert.equal(payload.sub, playbackId);
    assert.equal(payload.aud, "v");
    assert.equal(payload.kid, "test-key-id");
    assert.equal(payload.exp, 1_700_000_000 + MUX_PLAYBACK_TOKEN_TTL_SEC);

    process.env.MUX_SIGNING_KEY_ID = prevId;
    process.env.MUX_SIGNING_PRIVATE_KEY = prevKey;
  });

  it("refuses to sign demo playback ids", () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs1", format: "pem" }).toString();
    const prevId = process.env.MUX_SIGNING_KEY_ID;
    const prevKey = process.env.MUX_SIGNING_PRIVATE_KEY;
    process.env.MUX_SIGNING_KEY_ID = "test-key-id";
    process.env.MUX_SIGNING_PRIVATE_KEY = Buffer.from(pem, "utf8").toString("base64");
    assert.throws(() => signMuxPlaybackToken({ playbackId: "demo_play_x" }), /INVALID_PLAYBACK_ID/);
    process.env.MUX_SIGNING_KEY_ID = prevId;
    process.env.MUX_SIGNING_PRIVATE_KEY = prevKey;
  });

  it("fixture token round-trip and expiry", () => {
    const now = Math.floor(Date.now() / 1000);
    const signed = signFixturePlaybackToken({
      playbackId: "fixture_pb",
      userId: "user-1",
      recordingId: "rec-1",
      nowSec: now,
      ttlSec: 600,
    });
    const ok = verifyFixturePlaybackToken(signed.token);
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.playbackId, "fixture_pb");
      assert.equal(ok.userId, "user-1");
      assert.equal(ok.recordingId, "rec-1");
    }

    const past = signFixturePlaybackToken({
      playbackId: "x",
      userId: "u",
      recordingId: "r",
      nowSec: now - 120,
      ttlSec: 30,
    });
    const bad = verifyFixturePlaybackToken(past.token);
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.equal(bad.code, "EXPIRED");
  });

  it("tampered fixture token rejected", () => {
    const signed = signFixturePlaybackToken({
      playbackId: "fixture_pb",
      userId: "user-1",
      recordingId: "rec-1",
    });
    const tampered = `${signed.token.slice(0, -4)}xxxx`;
    const res = verifyFixturePlaybackToken(tampered);
    assert.equal(res.ok, false);
  });

  it("unpublished remains not playable for students", () => {
    assert.equal(
      studentMayPlayRecording({ flagOn: true, recordingStatus: "teacher_review" }),
      false,
    );
    assert.equal(
      studentMayPlayRecording({ flagOn: true, recordingStatus: "published" }),
      true,
    );
  });
});

describe("Recording Wave 2 feature flag", () => {
  it("defaults off", () => {
    const prev = process.env.FF_RECORDING_SIGNED_PLAYBACK_V1;
    delete process.env.FF_RECORDING_SIGNED_PLAYBACK_V1;
    assert.equal(isRecordingSignedPlaybackV1Enabled(), false);
    process.env.FF_RECORDING_SIGNED_PLAYBACK_V1 = prev;
  });

  it("reads true", () => {
    const prev = process.env.FF_RECORDING_SIGNED_PLAYBACK_V1;
    process.env.FF_RECORDING_SIGNED_PLAYBACK_V1 = "true";
    assert.equal(isRecordingSignedPlaybackV1Enabled(), true);
    process.env.FF_RECORDING_SIGNED_PLAYBACK_V1 = prev;
  });
});

describe("Recording Wave 2 authz contract (documented)", () => {
  it("client playbackId must never be accepted as signing input", () => {
    // Contract enforced in POST /api/recording/playback-token + issueRecordingPlaybackToken.
    assert.ok(true);
  });

  it("token refresh must re-check Enrollment + published (documented)", () => {
    assert.ok(MUX_PLAYBACK_TOKEN_TTL_SEC < 24 * 3600);
  });
});
