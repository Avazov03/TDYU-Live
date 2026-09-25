import { expect } from "@playwright/test";
import { test } from "../fixtures";
import { loginAs } from "../auth/login";
import {
  isE2EDbReady,
  skipReasonDbNotReady,
  studentCreds,
  teacherCreds,
  skipReasonMissingCreds,
} from "../helpers/env";
import { STAGING_FIXTURE } from "../helpers/test-data";

/**
 * Phase 8 Recording Wave 2 — signed playback authorization against staging.
 *
 * Requires:
 * - E2E_DB_READY=1
 * - E2E_RECORDING_WAVE2=1
 * - FF_RECORDING_REVIEW_V1 + FF_RECORDING_SIGNED_PLAYBACK_V1
 * - Dedicated lesson E2E_RECORDING_LESSON_ID / STAGING_FIXTURE.recordingLessonId
 *
 * Staging may lack Mux signing keys — fixture/local mode still verifies authz
 * and rejects client playbackId + unowned access. Never falls back to public Mux.
 */

function recordingWave2Enabled() {
  const v = process.env.E2E_RECORDING_WAVE2?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

const LESSON_ID =
  process.env.E2E_RECORDING_LESSON_ID_WAVE2?.trim() ||
  STAGING_FIXTURE.recordingLessonIdWave2 ||
  "";

test.describe("Recording Wave 2 signed playback", () => {
  test.beforeEach(() => {
    test.skip(!isE2EDbReady(), skipReasonDbNotReady());
    test.skip(
      !recordingWave2Enabled(),
      "Skipped: set E2E_RECORDING_WAVE2=1 and FF_RECORDING_SIGNED_PLAYBACK_V1=true",
    );
    test.skip(!LESSON_ID, "Missing E2E_RECORDING_LESSON_ID_WAVE2");
  });

  test("publish → enrolled token ALLOW; unowned DENY; playbackId rejected; unpublished DENY", async ({
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

    monitor.noteAction("Teacher ensures recording READY then publish");
    await loginAs(teacherPage, teacher!, { monitor });

    // Reset path: open/start/end if scheduled, else simulate_ready + publish.
    await teacherPage.goto(`/teacher/live/${LESSON_ID}`);
    await expect(teacherPage.locator(".live-studio")).toBeVisible({ timeout: 15_000 });

    if (await teacherPage.getByTestId("live-end").count()) {
      await teacherPage.getByTestId("live-end").click();
      await teacherPage.waitForTimeout(1000);
      await teacherPage.goto(`/teacher/live/${LESSON_ID}`);
    }
    const openBtn = teacherPage.getByTestId("live-open-waiting");
    if (await openBtn.count()) {
      await openBtn.click();
      await teacherPage.waitForTimeout(800);
      await teacherPage.goto(`/teacher/live/${LESSON_ID}`);
      await teacherPage.getByTestId("live-start").click();
      await teacherPage.waitForTimeout(1000);
      await teacherPage.goto(`/teacher/live/${LESSON_ID}`);
      await teacherPage.getByTestId("live-end").click();
      await teacherPage.waitForTimeout(1200);
    }

    const ready = await teacherPage.evaluate(async (lessonId) => {
      const res = await fetch(`/api/teacher/lessons/${lessonId}/recording/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "simulate_ready",
          recordingUrl: `/uploads/recordings/e2e-wave2-${lessonId}.webm`,
        }),
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    }, LESSON_ID);
    expect(ready.status).toBe(200);

    monitor.noteAction("Student before publish — token DENY");
    await loginAs(studentPage, student!, { monitor });
    const beforePub = await studentPage.evaluate(async (lessonId) => {
      const res = await fetch("/api/recording/playback-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId }),
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    }, LESSON_ID);
    expect(beforePub.status).toBe(403);
    expect(beforePub.body.code).toBe("NOT_PUBLISHED");

    monitor.noteAction("Teacher publish");
    const pub = await teacherPage.evaluate(async (lessonId) => {
      const res = await fetch(`/api/teacher/lessons/${lessonId}/recording/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish" }),
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    }, LESSON_ID);
    expect(pub.status).toBe(200);

    monitor.noteAction("Enrolled student token ALLOW");
    const allowed = await studentPage.evaluate(async (lessonId) => {
      const res = await fetch("/api/recording/playback-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId }),
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    }, LESSON_ID);
    expect(allowed.status).toBe(200);
    expect(allowed.body.ok).toBe(true);
    expect(["local", "fixture", "mux"]).toContain(allowed.body.mode);
    // Never expose a public Mux URL without token when mode is mux
    if (allowed.body.mode === "mux") {
      expect(allowed.body.playerUrl).toContain("token=");
      expect(allowed.body.token).toBeTruthy();
    }

    monitor.noteAction("Reject client-supplied playbackId");
    const badId = await studentPage.evaluate(async () => {
      const res = await fetch("/api/recording/playback-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: "00000000-0000-4000-8000-000000000001",
          playbackId: "attacker_playback_id",
        }),
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    });
    expect(badId.status).toBe(400);
    expect(badId.body.code).toBe("PLAYBACK_ID_NOT_ACCEPTED");

    monitor.noteAction("Deny lesson — unowned");
    const denyLesson =
      process.env.E2E_DENY_LESSON_ID?.trim() || STAGING_FIXTURE.denyLessonId;
    const deny = await studentPage.evaluate(async (lessonId) => {
      const res = await fetch("/api/recording/playback-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId }),
      });
      return res.status;
    }, denyLesson);
    expect(deny).toBeGreaterThanOrEqual(400);

    monitor.noteAction("Teacher preview token ALLOW");
    const teacherTok = await teacherPage.evaluate(async (lessonId) => {
      const res = await fetch("/api/recording/playback-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId }),
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    }, LESSON_ID);
    expect(teacherTok.status).toBe(200);

    monitor.noteAction("Refresh re-issues token");
    const refresh = await studentPage.evaluate(async (lessonId) => {
      const res = await fetch("/api/recording/playback-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId }),
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    }, LESSON_ID);
    expect(refresh.status).toBe(200);
    expect(refresh.body.ok).toBe(true);

    await teacherCtx.close();
    await studentCtx.close();
  });
});
