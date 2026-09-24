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
 * Phase 7 Live Wave 2 — A/V permission policy against staging.
 *
 * Requires:
 * - E2E_DB_READY=1
 * - E2E_LIVE_WAVE2=1
 * - Staging FF_LIVE_WAITING_ROOM_V2=true
 * - Staging FF_LIVE_AV_POLICY_V2=true
 * - E2E_LIVE_LESSON_ID (teacher-owned, enrollable by fixture student)
 *
 * Uses permission/signaling state — does not require physical camera hardware.
 * Launch with Playwright fake media if enabling devices:
 *   --use-fake-device-for-media-stream --use-fake-ui-for-media-stream
 */

function liveWave2Enabled() {
  const v = process.env.E2E_LIVE_WAVE2?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

const LIVE_LESSON_ID =
  process.env.E2E_LIVE_LESSON_ID?.trim() ||
  STAGING_FIXTURE.liveLessonId ||
  "";

test.describe("Live Wave 2 A/V policy", () => {
  test.beforeEach(() => {
    test.skip(!isE2EDbReady(), skipReasonDbNotReady());
    test.skip(
      !liveWave2Enabled(),
      "Skipped: set E2E_LIVE_WAVE2=1 and FF_LIVE_AV_POLICY_V2=true on staging",
    );
    test.skip(!LIVE_LESSON_ID, "Missing E2E_LIVE_LESSON_ID / STAGING_FIXTURE.liveLessonId");
  });

  test("Raise hand → grant → revoke; unauthorized student denied", async ({
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

    monitor.noteAction("Teacher opens waiting / live");
    await loginAs(teacherPage, teacher!, { monitor });
    await teacherPage.goto(`/teacher/live/${LIVE_LESSON_ID}`);
    await expect(teacherPage.locator(".live-studio")).toBeVisible({ timeout: 15_000 });

    const openBtn = teacherPage.getByTestId("live-open-waiting");
    if (await openBtn.count()) {
      await openBtn.click();
      await teacherPage.waitForTimeout(800);
      await teacherPage.goto(`/teacher/live/${LIVE_LESSON_ID}`);
    }

    const startBtn = teacherPage.getByTestId("live-start");
    if (await startBtn.count()) {
      await startBtn.click();
      await teacherPage.waitForTimeout(1200);
      await teacherPage.goto(`/teacher/live/${LIVE_LESSON_ID}`);
    }
    await expect(teacherPage.getByTestId("live-end")).toBeVisible({ timeout: 20_000 });

    monitor.noteAction("Student joins — camera/mic OFF by default");
    await loginAs(studentPage, student!, { monitor });
    await studentPage.goto(`/learn/${LIVE_LESSON_ID}`);
    await expect(studentPage.getByTestId("live-live-banner")).toBeVisible({ timeout: 25_000 });
    await expect(studentPage.getByTestId("live-mic-btn")).toHaveClass(/is-off/);
    await expect(studentPage.getByTestId("live-cam-btn")).toHaveClass(/is-off/);

    monitor.noteAction("Student raise hand → REQUESTED");
    await studentPage.getByTestId("live-raise-hand").click();
    await expect(studentPage.getByTestId("live-av-status")).toContainText(/Ruxsat so‘raldi|so‘raldi/i, {
      timeout: 10_000,
    });

    monitor.noteAction("Student cannot self-grant via API");
    const selfGrant = await studentPage.evaluate(async (lessonId) => {
      const res = await fetch("/api/live/av", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          action: "grant",
          targetPeerId: "u_self",
          mic: true,
          cam: true,
        }),
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    }, LIVE_LESSON_ID);
    expect(selfGrant.status).toBeGreaterThanOrEqual(400);

    monitor.noteAction("Teacher grants A/V");
    const peopleBtn = teacherPage.locator('button[title="Ishtirokchilar"]');
    if (await peopleBtn.count()) await peopleBtn.click();
    await expect(teacherPage.getByTestId("live-av-grant").first()).toBeVisible({ timeout: 15_000 });
    await teacherPage.getByTestId("live-av-grant").first().click();

    await expect(studentPage.getByTestId("live-av-status")).toContainText(/Ruxsat berildi/i, {
      timeout: 15_000,
    });
    // Grant ≠ auto-on
    await expect(studentPage.getByTestId("live-mic-btn")).toHaveClass(/is-off/);
    await expect(studentPage.getByTestId("live-cam-btn")).toHaveClass(/is-off/);

    monitor.noteAction("Teacher revokes A/V");
    await teacherPage.getByTestId("live-av-revoke").first().click();
    await expect(studentPage.getByTestId("live-av-status")).toContainText(/bekor/i, {
      timeout: 15_000,
    });
    await expect(studentPage.getByTestId("live-mic-btn")).toHaveClass(/is-off/);

    monitor.noteAction("Unauthorized / deny lesson cannot use A/V API");
    const denyLesson =
      process.env.E2E_DENY_LESSON_ID?.trim() || STAGING_FIXTURE.denyLessonId;
    const denyAv = await studentPage.evaluate(async (lessonId) => {
      const res = await fetch("/api/live/av", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, action: "raise_hand" }),
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    }, denyLesson);
    expect(denyAv.status).toBeGreaterThanOrEqual(400);

    await teacherCtx.close();
    await studentCtx.close();
  });
});
