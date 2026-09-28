import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  E2E_OWNED_LESSON_IDS,
  e2eFixtureResetGate,
  resetTokenMatches,
  resolveOwnedLessonIds,
} from "./e2e-fixture-reset";
import {
  classifyVodFromFacts,
  decideMigrationAction,
  fixtureSignedPlaybackIdFromPublic,
} from "./recording-legacy-migration";
import { STAGING_FIXTURE } from "../../e2e/helpers/test-data";

const TOKEN = "x".repeat(32);

describe("e2e fixture reset gate", () => {
  it("is closed in production-like environments even with a token", () => {
    const gate = e2eFixtureResetGate({ token: TOKEN, productionLike: true });
    assert.equal(gate.allowed, false);
  });

  it("is closed without a configured token or with a short token", () => {
    assert.equal(e2eFixtureResetGate({ token: undefined, productionLike: false }).allowed, false);
    assert.equal(e2eFixtureResetGate({ token: "short", productionLike: false }).allowed, false);
  });

  it("opens only for a non-production process with a long token", () => {
    const gate = e2eFixtureResetGate({ token: TOKEN, productionLike: false });
    assert.equal(gate.allowed, true);
  });

  it("matches tokens exactly", () => {
    assert.equal(resetTokenMatches(TOKEN, TOKEN), true);
    assert.equal(resetTokenMatches(null, TOKEN), false);
    assert.equal(resetTokenMatches(TOKEN.slice(1), TOKEN), false);
    assert.equal(resetTokenMatches(`${TOKEN.slice(1)}y`, TOKEN), false);
  });
});

describe("e2e fixture reset scope", () => {
  it("defaults to every E2E-owned lesson", () => {
    assert.deepEqual(resolveOwnedLessonIds(undefined), [...E2E_OWNED_LESSON_IDS]);
    assert.deepEqual(resolveOwnedLessonIds([]), [...E2E_OWNED_LESSON_IDS]);
  });

  it("drops ids that are not E2E-owned", () => {
    assert.deepEqual(
      resolveOwnedLessonIds([STAGING_FIXTURE.liveLessonId, STAGING_FIXTURE.lessonId, 42]),
      [STAGING_FIXTURE.liveLessonId],
    );
    assert.deepEqual(resolveOwnedLessonIds([STAGING_FIXTURE.lessonId]), []);
  });

  it("covers every stateful lesson used by the browser suites", () => {
    const stateful = [
      STAGING_FIXTURE.liveLessonId,
      STAGING_FIXTURE.liveLessonIdWave3,
      STAGING_FIXTURE.recordingLessonId,
      STAGING_FIXTURE.recordingLessonIdWave2,
      STAGING_FIXTURE.recordingLessonIdWave3,
      STAGING_FIXTURE.liveMuxLessonId,
    ];
    assert.deepEqual([...stateful].sort(), [...E2E_OWNED_LESSON_IDS].sort());
  });
});

describe("legacy migration rerun (wave3 fixture)", () => {
  it("a migrated fixture recording is no longer PUBLIC, so reruns need a fresh public seed", () => {
    const migratedId = fixtureSignedPlaybackIdFromPublic("legacy_public_wave3_fixture");
    const classified = classifyVodFromFacts({
      muxPlaybackId: migratedId,
      storageKey: null,
      muxPolicy: "fixture_signed",
      muxLookupAttempted: true,
      muxFound: true,
    });
    assert.equal(classified.vodClass, "SIGNED_VOD");
    const decision = decideMigrationAction({
      vodClass: classified.vodClass,
      appState: "PUBLISHED",
      priorMigration: true,
      dryRun: true,
    });
    assert.equal(decision.action, "WOULD_SKIP");
  });
});
