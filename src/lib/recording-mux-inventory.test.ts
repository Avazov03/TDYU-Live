import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertAuditOnlyInventoryMode,
  getMuxReadOnlyCounters,
  muxReadOnlyFetch,
  resetMuxReadOnlyCounters,
} from "./mux-read-only";
import {
  classifyRecordingUrl,
  decideMigrationBucket,
  resolveInventoryEnvironment,
} from "./recording-mux-inventory";
import { assertMigrationApplyAllowed } from "./recording-legacy-migration";

describe("Mux read-only client", () => {
  it("rejects non-GET before network", async () => {
    resetMuxReadOnlyCounters();
    await assert.rejects(
      () => muxReadOnlyFetch("/video/v1/assets/x", { method: "POST" }),
      /MUX_READ_ONLY_VIOLATION/,
    );
    await assert.rejects(
      () => muxReadOnlyFetch("/video/v1/assets/x", { method: "DELETE" }),
      /MUX_READ_ONLY_VIOLATION/,
    );
    const c = getMuxReadOnlyCounters();
    assert.equal(c.MUX_POST, 0);
    assert.equal(c.MUX_DELETE, 0);
    assert.equal(c.MUX_GET, 0);
  });

  it("requires AUDIT_ONLY + inventory mode", () => {
    const prevA = process.env.AUDIT_ONLY;
    const prevM = process.env.RECORDING_MIGRATION_MODE;
    delete process.env.AUDIT_ONLY;
    delete process.env.RECORDING_MIGRATION_MODE;
    assert.throws(() => assertAuditOnlyInventoryMode(), /AUDIT_ONLY/);
    process.env.AUDIT_ONLY = "true";
    assert.throws(() => assertAuditOnlyInventoryMode(), /RECORDING_MIGRATION_MODE/);
    process.env.RECORDING_MIGRATION_MODE = "inventory";
    assert.doesNotThrow(() => assertAuditOnlyInventoryMode());
    process.env.AUDIT_ONLY = prevA;
    process.env.RECORDING_MIGRATION_MODE = prevM;
  });
});

describe("Recording Mux inventory classifiers", () => {
  it("classifies recordingUrl kinds", () => {
    assert.equal(classifyRecordingUrl(null), "EMPTY");
    assert.equal(classifyRecordingUrl("/uploads/recordings/a.webm"), "LOCAL");
    assert.equal(classifyRecordingUrl("https://stream.mux.com/abc.m3u8"), "MUX_PUBLIC");
    assert.equal(
      classifyRecordingUrl("https://player.mux.com/abc?token=jwt"),
      "MUX_SIGNED",
    );
    assert.equal(classifyRecordingUrl("https://cdn.example/x"), "OTHER");
  });

  it("SAFE_CANDIDATE only for verified public with asset", () => {
    const ok = decideMigrationBucket({
      vodClass: "PUBLIC_VOD",
      recordingStatus: "published",
      muxPolicy: "public",
      muxAssetId: "asset_1",
      hasValidLesson: true,
      muxApiAvailable: true,
    });
    assert.equal(ok.bucket, "SAFE_CANDIDATE");

    const noAsset = decideMigrationBucket({
      vodClass: "PUBLIC_VOD",
      recordingStatus: "published",
      muxPolicy: "public",
      muxAssetId: null,
      hasValidLesson: true,
      muxApiAvailable: true,
    });
    assert.equal(noAsset.bucket, "BLOCKED");

    const signed = decideMigrationBucket({
      vodClass: "SIGNED_VOD",
      recordingStatus: "published",
      muxPolicy: "signed",
      muxAssetId: "a",
      hasValidLesson: true,
      muxApiAvailable: true,
    });
    assert.equal(signed.bucket, "ALREADY_SIGNED");
  });

  it("staging port resolves as STAGING", () => {
    const prev = process.env.PORT;
    process.env.PORT = "3101";
    assert.equal(resolveInventoryEnvironment(), "STAGING");
    process.env.PORT = prev;
  });
});

describe("Migration apply blocked in audit mode", () => {
  it("forbids apply when AUDIT_ONLY", () => {
    const prev = process.env.AUDIT_ONLY;
    process.env.AUDIT_ONLY = "true";
    assert.throws(
      () =>
        assertMigrationApplyAllowed({
          apply: true,
          isProduction: false,
          confirmRecordingMigration: true,
          confirmProductionRecordingMigration: true,
          flagEnabled: true,
        }),
      /AUDIT_ONLY/,
    );
    process.env.AUDIT_ONLY = prev;
  });
});
