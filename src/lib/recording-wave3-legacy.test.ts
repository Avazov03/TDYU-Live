import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertMigrationApplyAllowed,
  classifyVodFromFacts,
  decideMigrationAction,
  fixtureSignedPlaybackIdFromPublic,
  isFixturePublicPlaybackId,
  isFixtureSignedPlaybackId,
  mapAppRecordingState,
} from "./recording-legacy-migration";
import {
  isRecordingLegacyMigrationV1Enabled,
  mustUseSecureMuxPlayback,
} from "./feature-flags";

describe("Recording Wave 3 classification", () => {
  it("maps app states", () => {
    assert.equal(mapAppRecordingState("published"), "PUBLISHED");
    assert.equal(mapAppRecordingState("teacher_review"), "READY");
    assert.equal(mapAppRecordingState("failed"), "FAILED");
    assert.equal(mapAppRecordingState("not_started"), "NOT_PUBLISHED");
  });

  it("classifies local-only", () => {
    const r = classifyVodFromFacts({
      muxPlaybackId: null,
      storageKey: "/uploads/recordings/x.webm",
      muxPolicy: null,
      muxLookupAttempted: false,
      muxFound: null,
    });
    assert.equal(r.vodClass, "LOCAL_ONLY");
  });

  it("classifies missing when no media", () => {
    const r = classifyVodFromFacts({
      muxPlaybackId: null,
      storageKey: null,
      muxPolicy: null,
      muxLookupAttempted: false,
      muxFound: null,
    });
    assert.equal(r.vodClass, "MISSING_ASSET");
  });

  it("classifies fixture public / signed", () => {
    assert.ok(isFixturePublicPlaybackId("legacy_public_wave3"));
    assert.ok(isFixtureSignedPlaybackId("legacy_signed_wave3"));
    assert.equal(
      fixtureSignedPlaybackIdFromPublic("legacy_public_wave3"),
      "legacy_signed_wave3",
    );
    const pub = classifyVodFromFacts({
      muxPlaybackId: "legacy_public_wave3",
      storageKey: null,
      muxPolicy: "fixture_public",
      muxLookupAttempted: true,
      muxFound: true,
    });
    assert.equal(pub.vodClass, "PUBLIC_VOD");
    const signed = classifyVodFromFacts({
      muxPlaybackId: "legacy_signed_wave3",
      storageKey: null,
      muxPolicy: "fixture_signed",
      muxLookupAttempted: true,
      muxFound: true,
    });
    assert.equal(signed.vodClass, "SIGNED_VOD");
  });

  it("classifies real Mux public / signed / missing / unknown", () => {
    assert.equal(
      classifyVodFromFacts({
        muxPlaybackId: "abc",
        storageKey: null,
        muxPolicy: "public",
        muxLookupAttempted: true,
        muxFound: true,
      }).vodClass,
      "PUBLIC_VOD",
    );
    assert.equal(
      classifyVodFromFacts({
        muxPlaybackId: "abc",
        storageKey: null,
        muxPolicy: "signed",
        muxLookupAttempted: true,
        muxFound: true,
      }).vodClass,
      "SIGNED_VOD",
    );
    assert.equal(
      classifyVodFromFacts({
        muxPlaybackId: "abc",
        storageKey: null,
        muxPolicy: null,
        muxLookupAttempted: true,
        muxFound: false,
      }).vodClass,
      "MISSING_ASSET",
    );
    assert.equal(
      classifyVodFromFacts({
        muxPlaybackId: "abc",
        storageKey: null,
        muxPolicy: null,
        muxLookupAttempted: false,
        muxFound: null,
      }).vodClass,
      "UNKNOWN",
    );
  });
});

describe("Recording Wave 3 migration decisions", () => {
  it("dry-run public → WOULD_MIGRATE", () => {
    const d = decideMigrationAction({
      vodClass: "PUBLIC_VOD",
      appState: "PUBLISHED",
      priorMigration: false,
      dryRun: true,
    });
    assert.equal(d.action, "WOULD_MIGRATE");
  });

  it("dry-run signed → WOULD_SKIP", () => {
    const d = decideMigrationAction({
      vodClass: "SIGNED_VOD",
      appState: "PUBLISHED",
      priorMigration: false,
      dryRun: true,
    });
    assert.equal(d.action, "WOULD_SKIP");
  });

  it("dry-run local → WOULD_SKIP", () => {
    const d = decideMigrationAction({
      vodClass: "LOCAL_ONLY",
      appState: "PUBLISHED",
      priorMigration: false,
      dryRun: true,
    });
    assert.equal(d.action, "WOULD_SKIP");
  });

  it("dry-run missing/unknown → WOULD_BLOCK", () => {
    assert.equal(
      decideMigrationAction({
        vodClass: "MISSING_ASSET",
        appState: "PUBLISHED",
        priorMigration: false,
        dryRun: true,
      }).action,
      "WOULD_BLOCK",
    );
    assert.equal(
      decideMigrationAction({
        vodClass: "UNKNOWN",
        appState: "PUBLISHED",
        priorMigration: false,
        dryRun: true,
      }).action,
      "WOULD_BLOCK",
    );
  });

  it("prior migration → skip", () => {
    const d = decideMigrationAction({
      vodClass: "PUBLIC_VOD",
      appState: "PUBLISHED",
      priorMigration: true,
      dryRun: true,
    });
    assert.equal(d.action, "WOULD_SKIP");
  });

  it("failed recording blocked", () => {
    const d = decideMigrationAction({
      vodClass: "PUBLIC_VOD",
      appState: "FAILED",
      priorMigration: false,
      dryRun: true,
    });
    assert.equal(d.action, "WOULD_BLOCK");
  });
});

describe("Recording Wave 3 apply gates", () => {
  it("blocks apply without confirm", () => {
    assert.throws(
      () =>
        assertMigrationApplyAllowed({
          apply: true,
          isProduction: false,
          confirmRecordingMigration: false,
          confirmProductionRecordingMigration: false,
          flagEnabled: true,
        }),
      /CONFIRM_RECORDING_MIGRATION/,
    );
  });

  it("blocks production apply without dual confirm", () => {
    assert.throws(
      () =>
        assertMigrationApplyAllowed({
          apply: true,
          isProduction: true,
          confirmRecordingMigration: true,
          confirmProductionRecordingMigration: false,
          flagEnabled: true,
        }),
      /CONFIRM_PRODUCTION_RECORDING_MIGRATION/,
    );
  });

  it("allows staging apply with flag + confirm", () => {
    assert.doesNotThrow(() =>
      assertMigrationApplyAllowed({
        apply: true,
        isProduction: false,
        confirmRecordingMigration: true,
        confirmProductionRecordingMigration: false,
        flagEnabled: true,
      }),
    );
  });

  it("dry-run never requires confirm", () => {
    assert.doesNotThrow(() =>
      assertMigrationApplyAllowed({
        apply: false,
        isProduction: true,
        confirmRecordingMigration: false,
        confirmProductionRecordingMigration: false,
        flagEnabled: false,
      }),
    );
  });
});

describe("Recording Wave 3 feature flags", () => {
  it("legacy migration flag defaults off", () => {
    const prev = process.env.FF_RECORDING_LEGACY_MIGRATION_V1;
    delete process.env.FF_RECORDING_LEGACY_MIGRATION_V1;
    assert.equal(isRecordingLegacyMigrationV1Enabled(), false);
    process.env.FF_RECORDING_LEGACY_MIGRATION_V1 = prev;
  });

  it("mustUseSecureMuxPlayback when wave2 or wave3 on", () => {
    const prev2 = process.env.FF_RECORDING_SIGNED_PLAYBACK_V1;
    const prev3 = process.env.FF_RECORDING_LEGACY_MIGRATION_V1;
    delete process.env.FF_RECORDING_SIGNED_PLAYBACK_V1;
    delete process.env.FF_RECORDING_LEGACY_MIGRATION_V1;
    assert.equal(mustUseSecureMuxPlayback(), false);
    process.env.FF_RECORDING_LEGACY_MIGRATION_V1 = "true";
    assert.equal(mustUseSecureMuxPlayback(), true);
    delete process.env.FF_RECORDING_LEGACY_MIGRATION_V1;
    process.env.FF_RECORDING_SIGNED_PLAYBACK_V1 = "true";
    assert.equal(mustUseSecureMuxPlayback(), true);
    process.env.FF_RECORDING_SIGNED_PLAYBACK_V1 = prev2;
    process.env.FF_RECORDING_LEGACY_MIGRATION_V1 = prev3;
  });
});
