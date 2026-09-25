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
 * Phase 8 Recording Wave 1 — lifecycle against staging.
 *
 * Requires:
 * - E2E_DB_READY=1
 * - E2E_RECORDING_WAVE1=1
 * - FF_RECORDING_REVIEW_V1=true (+ Live waiting room for start/end)
 * - Dedicated lesson E2E_RECORDING_LESSON_ID / STAGING_FIXTURE.recordingLessonId
 */

function recordingWave1Enabled() {
  const v = process.env.E2E_RECORDING_WAVE1?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

const LESSON_ID =
  process.env.E2E_RECORDING_LESSON_ID?.trim() ||
  STAGING_FIXTURE.recordingLessonId ||
  "";

test.describe("Recording Wave 1 lifecycle", () => {
  test.beforeEach(() => {
    test.skip(!isE2EDbReady(), skipReasonDbNotReady());
    test.skip(
      !recordingWave1Enabled(),
      "Skipped: set E2E_RECORDING_WAVE1=1 and FF_RECORDING_REVIEW_V1=true on staging",
    );
    test.skip(!LESSON_ID, "Missing E2E_RECORDING_LESSON_ID");
  });

  test("End → ready (simulate) → student denied → publish → student allowed", async ({
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

    monitor.noteAction("Teacher open waiting → start → end");
    await loginAs(teacherPage, teacher!, { monitor });
    await teacherPage.goto(`/teacher/live/${LESSON_ID}`);
    await expect(teacherPage.locator(".live-studio")).toBeVisible({ timeout: 15_000 });

    if (await teacherPage.getByTestId("live-end").count()) {
      await teacherPage.getByTestId("live-end").click();
      await teacherPage.waitForTimeout(1000);
      await teacherPage.goto(`/teacher/live/${LESSON_ID}`);
    }
    const openBtn = teacherPage.getByTestId("live-open-waiting");
    const startBtn = teacherPage.getByTestId("live-start");
    if ((await openBtn.count()) === 0 && (await startBtn.count()) === 0) {
      throw new Error(
        `Recording fixture lesson ${LESSON_ID} not reopenable — reset lessons.status to scheduled`,
      );
    }
    if (await openBtn.count()) {
      await openBtn.click();
      await teacherPage.waitForTimeout(800);
      await teacherPage.goto(`/teacher/live/${LESSON_ID}`);
    }
    await expect(teacherPage.getByTestId("live-start")).toBeVisible({ timeout: 15_000 });
    await teacherPage.getByTestId("live-start").click();
    await teacherPage.waitForTimeout(1200);
    await teacherPage.goto(`/teacher/live/${LESSON_ID}`);
    await expect(teacherPage.getByTestId("live-end")).toBeVisible({ timeout: 20_000 });
    await teacherPage.getByTestId("live-end").click();
    await teacherPage.waitForTimeout(1500);

    monitor.noteAction("Simulate READY via teacher hook");
    await teacherPage.goto(`/teacher/live/${LESSON_ID}`);
    const readyRes = await teacherPage.evaluate(async (lessonId) => {
      const res = await fetch(`/api/teacher/lessons/${lessonId}/recording/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "simulate_ready",
          recordingUrl: `/uploads/recordings/e2e-fixture-${lessonId}.webm`,
        }),
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    }, LESSON_ID);
    expect(readyRes.status).toBe(200);
    expect(["ready", "teacher_review"]).toContain(readyRes.body?.recording?.status);

    monitor.noteAction("Student before publish — not playable");
    await loginAs(studentPage, student!, { monitor });
    const before = await studentPage.evaluate(async (lessonId) => {
      const res = await fetch(`/api/recording/status?lessonId=${encodeURIComponent(lessonId)}`);
      return { status: res.status, body: await res.json().catch(() => ({})) };
    }, LESSON_ID);
    expect(before.status).toBe(200);
    expect(before.body.published).toBe(false);
    expect(before.body.playable).toBe(false);

    const mediaBefore = await studentPage.evaluate(async (lessonId) => {
      const res = await fetch(`/api/media/recording/${lessonId}`);
      return res.status;
    }, LESSON_ID);
    expect(mediaBefore).toBe(403);

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
    expect(pub.body?.recording?.status).toBe("published");

    monitor.noteAction("Student after publish — playable");
    const after = await studentPage.evaluate(async (lessonId) => {
      const res = await fetch(`/api/recording/status?lessonId=${encodeURIComponent(lessonId)}`);
      return { status: res.status, body: await res.json().catch(() => ({})) };
    }, LESSON_ID);
    expect(after.status).toBe(200);
    expect(after.body.published).toBe(true);
    expect(after.body.playable).toBe(true);

    monitor.noteAction("Unauthorized deny lesson — status denied");
    const denyLesson =
      process.env.E2E_DENY_LESSON_ID?.trim() || STAGING_FIXTURE.denyLessonId;
    const deny = await studentPage.evaluate(async (lessonId) => {
      const res = await fetch(`/api/recording/status?lessonId=${encodeURIComponent(lessonId)}`);
      return res.status;
    }, denyLesson);
    expect(deny).toBeGreaterThanOrEqual(400);

    await teacherCtx.close();
    await studentCtx.close();
  });
});
