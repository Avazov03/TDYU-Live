import { expect } from "@playwright/test";
import { test } from "../fixtures";
import { loginAs } from "../auth/login";
import {
  isE2EDbReady,
  skipReasonDbNotReady,
  studentCreds,
  teacherCreds,
  adminCreds,
  skipReasonMissingCreds,
} from "../helpers/env";
import { STAGING_FIXTURE } from "../helpers/test-data";

/**
 * Phase 8 Recording Wave 3 — legacy VOD migration + security completion.
 *
 * Requires:
 * - E2E_DB_READY=1
 * - E2E_RECORDING_WAVE3=1
 * - FF_RECORDING_REVIEW_V1 + FF_RECORDING_SIGNED_PLAYBACK_V1 + FF_RECORDING_LEGACY_MIGRATION_V1
 * - Dedicated lesson E2E_RECORDING_LESSON_ID_WAVE3 / …049
 *
 * Staging has no real Mux token → FIXTURE verification for legacy_public_* ids.
 */

function recordingWave3Enabled() {
  const v = process.env.E2E_RECORDING_WAVE3?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

const LESSON_ID =
  process.env.E2E_RECORDING_LESSON_ID_WAVE3?.trim() ||
  STAGING_FIXTURE.recordingLessonIdWave3 ||
  "";

const PUBLIC_ID = "legacy_public_wave3_fixture";
const SIGNED_ID = "legacy_signed_wave3_fixture";

test.describe("Recording Wave 3 legacy migration", () => {
  test.beforeEach(() => {
    test.skip(!isE2EDbReady(), skipReasonDbNotReady());
    test.skip(
      !recordingWave3Enabled(),
      "Skipped: set E2E_RECORDING_WAVE3=1 and FF_RECORDING_LEGACY_MIGRATION_V1=true",
    );
    test.skip(!LESSON_ID, "Missing E2E_RECORDING_LESSON_ID_WAVE3");
  });

  test("dry-run detects public fixture; apply migrates once; authz holds", async ({
    browser,
    monitor,
  }) => {
    const teacher = teacherCreds();
    const student = studentCreds();
    test.skip(!teacher, skipReasonMissingCreds("teacher"));
    test.skip(!student, skipReasonMissingCreds("student"));

    const teacherCtx = await browser.newContext();
    const studentCtx = await browser.newContext();
    const teacherPage = await teacherCtx.newPage();
    const studentPage = await studentCtx.newPage();

    monitor.noteAction("Seed Wave 3 public fixture via teacher simulate + DB-shaped publish");
    await loginAs(teacherPage, teacher!, { monitor });

    // Ensure a published recording with legacy public fixture playback id.
    const seed = await teacherPage.evaluate(
      async ({ lessonId, publicId }) => {
        const ready = await fetch(`/api/teacher/lessons/${lessonId}/recording/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "simulate_ready",
            muxPlaybackId: publicId,
          }),
        });
        const readyBody = await ready.json().catch(() => ({}));
        const pub = await fetch(`/api/teacher/lessons/${lessonId}/recording/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "publish" }),
        });
        const pubBody = await pub.json().catch(() => ({}));
        return {
          readyStatus: ready.status,
          readyBody,
          pubStatus: pub.status,
          pubBody,
          recordingId:
            (pubBody as { recording?: { id?: string } }).recording?.id ||
            (readyBody as { recording?: { id?: string } }).recording?.id ||
            null,
        };
      },
      { lessonId: LESSON_ID, publicId: PUBLIC_ID },
    );
    expect(seed.readyStatus).toBe(200);
    expect(seed.pubStatus).toBe(200);
    expect(seed.recordingId).toBeTruthy();

    monitor.noteAction("Dry-run via admin API — no mutation");
    // Teacher is not admin — use student token endpoint checks + migration dry-run
    // through fetch as teacher if admin, else classify via playback id presence.
    // Staging admin may not be logged in; use dedicated migrate endpoint with admin
    // session if available, otherwise verify dry-run contract via unauthenticated deny
    // and student authz matrix.

    await loginAs(studentPage, student!, { monitor });

    // Unowned / IDOR: other course deny lesson token
    const denyLesson =
      process.env.E2E_DENY_LESSON_ID?.trim() || STAGING_FIXTURE.denyLessonId;
    const idor = await studentPage.evaluate(async (lessonId) => {
      const res = await fetch("/api/recording/playback-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId }),
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    }, denyLesson);
    expect(idor.status).toBeGreaterThanOrEqual(403);

    // Client playbackId rejected
    const arbitrary = await studentPage.evaluate(async () => {
      const res = await fetch("/api/recording/playback-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playbackId: "attacker_playback" }),
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    });
    expect([400, 403]).toContain(arbitrary.status);

    monitor.noteAction("Admin dry-run + apply migration (fixture)");
    const admin = adminCreds();
    test.skip(!admin, skipReasonMissingCreds("admin"));

    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await loginAs(adminPage, admin!, { monitor });

    const dry = await adminPage.evaluate(async (recordingId) => {
      const res = await fetch("/api/admin/recording/legacy-migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: true, recordingId }),
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    }, seed.recordingId);
    expect(dry.status).toBe(200);
    expect(dry.body.dryRun).toBe(true);
    expect(dry.body.PUBLIC).toBeGreaterThanOrEqual(1);
    expect(dry.body.WOULD_MIGRATE).toBeGreaterThanOrEqual(1);
    expect(dry.body.MIGRATED ?? 0).toBe(0);

    const apply1 = await adminPage.evaluate(async (recordingId) => {
      const res = await fetch("/api/admin/recording/legacy-migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false, confirm: true, recordingId }),
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    }, seed.recordingId);
    expect(apply1.status).toBe(200);
    expect(apply1.body.MIGRATED).toBeGreaterThanOrEqual(1);
    const migrated = (apply1.body.items as Array<{ muxPlaybackId?: string }>)?.[0];
    expect(migrated?.muxPlaybackId).toBe(SIGNED_ID);

    const apply2 = await adminPage.evaluate(async (recordingId) => {
      const res = await fetch("/api/admin/recording/legacy-migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false, confirm: true, recordingId }),
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    }, seed.recordingId);
    expect(apply2.status).toBe(200);
    expect(apply2.body.MIGRATED ?? 0).toBe(0);
    expect((apply2.body.SKIPPED ?? 0) + (apply2.body.WOULD_SKIP ?? 0)).toBeGreaterThanOrEqual(1);

    monitor.noteAction("Enrolled student token ALLOW after migrate");
    const allow = await studentPage.evaluate(async (lessonId) => {
      const res = await fetch("/api/recording/playback-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId }),
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    }, LESSON_ID);
    expect(allow.status).toBe(200);
    expect(allow.body.ok).toBe(true);

    // Learn page must not embed public player.mux.com without token
    await studentPage.goto(`/learn/${LESSON_ID}`);
    const html = await studentPage.content();
    expect(html).not.toContain(`player.mux.com/${PUBLIC_ID}`);
    expect(html).not.toContain(`?playbackId=`);

    await teacherCtx.close();
    await studentCtx.close();
    await adminCtx.close();
  });
});
