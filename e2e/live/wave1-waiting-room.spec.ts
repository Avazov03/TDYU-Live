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
import { resetE2EFixtures, teardownE2EFixtures } from "../helpers/fixture-reset";
import { studioAction } from "../helpers/live-studio";

/**
 * Phase 7 Live Wave 1 — waiting room + start/end against staging.
 *
 * Requires:
 * - E2E_DB_READY=1
 * - E2E_LIVE_WAVE1=1
 * - Staging FF_LIVE_WAITING_ROOM_V2=true
 * - E2E_LIVE_LESSON_ID = scheduled/lobby lesson on Course A (teacher-owned)
 */

function liveWave1Enabled() {
  const v = process.env.E2E_LIVE_WAVE1?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

const LIVE_LESSON_ID =
  process.env.E2E_LIVE_LESSON_ID?.trim() ||
  STAGING_FIXTURE.liveLessonId ||
  "";

test.describe("Live Wave 1 waiting room", () => {
  test.beforeEach(async () => {
    test.skip(!isE2EDbReady(), skipReasonDbNotReady());
    test.skip(
      !liveWave1Enabled(),
      "Skipped: set E2E_LIVE_WAVE1=1 and FF_LIVE_WAITING_ROOM_V2=true on staging",
    );
    test.skip(!LIVE_LESSON_ID, "Missing E2E_LIVE_LESSON_ID / STAGING_FIXTURE.liveLessonId");
    await resetE2EFixtures([LIVE_LESSON_ID]);
  });

  test.afterAll(async () => {
    if (isE2EDbReady() && liveWave1Enabled() && LIVE_LESSON_ID) {
      await teardownE2EFixtures([LIVE_LESSON_ID]);
    }
  });

  test("Teacher opens waiting room, student joins, start/end lifecycle", async ({
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

    monitor.noteAction("Teacher login → live studio");
    await loginAs(teacherPage, teacher!, { monitor });
    await teacherPage.goto(`/teacher/live/${LIVE_LESSON_ID}`);
    await expect(teacherPage.locator(".live-studio")).toBeVisible({ timeout: 15_000 });

    await studioAction(teacherPage, LIVE_LESSON_ID, "lobby");
    await teacherPage.goto(`/teacher/live/${LIVE_LESSON_ID}`);
    await expect(teacherPage.getByTestId("live-start")).toBeVisible({ timeout: 15_000 });

    monitor.noteAction("Student joins waiting room");
    await loginAs(studentPage, student!, { monitor });
    await studentPage.goto(`/learn/${LIVE_LESSON_ID}`);
    await expect(studentPage.getByTestId("live-waiting-message")).toBeVisible({
      timeout: 20_000,
    });

    monitor.noteAction("Teacher starts live");
    await studioAction(teacherPage, LIVE_LESSON_ID, "start");
    await teacherPage.goto(`/teacher/live/${LIVE_LESSON_ID}`);
    await expect(teacherPage.getByTestId("live-end")).toBeVisible({ timeout: 20_000 });

    monitor.noteAction("Student sees LIVE");
    await studentPage.reload();
    await expect(studentPage.getByTestId("live-live-banner")).toBeVisible({ timeout: 20_000 });

    monitor.noteAction("Teacher ends live");
    await studioAction(teacherPage, LIVE_LESSON_ID, "end");

    monitor.noteAction("Student cannot rejoin ended as live room");
    // /end finishes the final recording upload and Mux completion before the lesson leaves "live".
    await expect
      .poll(
        () =>
          studentPage.evaluate(async (lessonId) => {
            const res = await fetch("/api/live/join", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ lessonId }),
            });
            return res.status;
          }, LIVE_LESSON_ID),
        { timeout: 30_000 },
      )
      .toBeGreaterThanOrEqual(400);

    await teacherCtx.close();
    await studentCtx.close();
  });

  test("Unauthorized student is denied join", async ({ page, monitor }) => {
    // Uses deny-probe student if provided; otherwise hits join without enrollment via API after login as active1 on deny lesson.
    const student = studentCreds();
    test.skip(!student, skipReasonMissingCreds("student"));
    const denyLesson =
      process.env.E2E_DENY_LESSON_ID?.trim() || STAGING_FIXTURE.denyLessonId;

    await loginAs(page, student!, { monitor });
    const joinRes = await page.evaluate(async (lessonId) => {
      const res = await fetch("/api/live/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId }),
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    }, denyLesson);
    expect(joinRes.status).toBe(403);
  });
});
