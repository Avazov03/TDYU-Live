import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { loginAs } from "../auth/login";
import {
  isE2EDbReady,
  skipReasonDbNotReady,
  studentCreds,
  skipReasonMissingCreds,
} from "../helpers/env";
import { ACCESS_FIXTURES, STAGING_FIXTURE } from "../helpers/test-data";

/**
 * Enrollment-authoritative browser checks (Phase 2.6 cutover matrix).
 *
 * NOT part of `test:e2e:smoke`. Run with:
 *   E2E_DB_READY=1 E2E_ENROLLMENT_AUTHORITATIVE=1 npm run test:e2e:access
 *
 * Staging must have FF_ENROLLMENT_ACCESS_MODE=enrollment and the access fixtures
 * (`npx tsx scripts/e2e-access-fixtures.ts` in the staging app dir).
 */
function enrollmentAuthoritativeEnabled() {
  const v = process.env.E2E_ENROLLMENT_AUTHORITATIVE?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

const COURSE_A = STAGING_FIXTURE.courseId;
const LESSON_A = STAGING_FIXTURE.lessonId;
const LESSON_A_TITLE = STAGING_FIXTURE.lessonTitle;
/** Never purchased by fixture.active1. */
const DENY_LESSON =
  process.env.E2E_DENY_LESSON_ID?.trim() || STAGING_FIXTURE.denyLessonId;
const DENY_LESSON_TITLE = STAGING_FIXTURE.denyLessonTitle;

const PAYWALL_CTA = /Tarifni oshirish|Kurslarni ko/i;
const NOT_ENROLLED = /yozilmagansiz/i;
/** Refunded / cancelled seat (enrollment-mode copy, or the legacy "expired" copy on older builds). */
const SEAT_CLOSED = /kirish yopilgan|Obuna muddati/i;

/**
 * Lesson-scoped API status codes with the browser's session cookie. Probed from a second,
 * unmonitored tab: the session cookie is Secure (only the browser sends it to http://127.0.0.1),
 * and expected 403/404s must not count as console errors on the page under test.
 */
async function lessonApiStatus(page: Page, lessonId: string) {
  const probe = await page.context().newPage();
  try {
    const chat = await probe.goto(`/api/lessons/${lessonId}/chat`);
    const recording = await probe.goto(`/api/media/recording/${lessonId}`);
    return { chat: chat?.status() ?? 0, recording: recording?.status() ?? 0 };
  } finally {
    await probe.close();
  }
}

async function expectLessonAllowed(page: Page, lessonId: string, title: string) {
  const res = await page.goto(`/learn/${lessonId}`);
  expect(res?.status(), "lesson HTTP").toBeLessThan(400);
  await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
  await expect(page.locator(".player-wrap.paywall")).toHaveCount(0);
  await expect(page.getByRole("link", { name: PAYWALL_CTA })).toHaveCount(0);
  const api = await lessonApiStatus(page, lessonId);
  expect(api.chat, "chat API for owned lesson").toBe(200);
  expect(api.recording, "recording API must not be forbidden").not.toBe(403);
}

async function expectLessonDenied(page: Page, lessonId: string, title: string, message: RegExp) {
  await page.goto(`/learn/${lessonId}`);
  const paywall = page.locator(".player-wrap.paywall");
  await expect(paywall).toBeVisible({ timeout: 15_000 });
  await expect(paywall.getByRole("heading", { name: title })).toBeVisible();
  await expect(paywall.getByText(message)).toBeVisible();
  await expect(paywall.getByRole("link", { name: PAYWALL_CTA })).toBeVisible();
  await expect(page.getByTestId("recording-player")).toHaveCount(0);
  const api = await lessonApiStatus(page, lessonId);
  expect(api.chat, "chat API must be denied").toBe(403);
  expect([401, 403, 404], "recording API must never serve media").toContain(api.recording);
}

test.describe("Enrollment authoritative access", () => {
  test.beforeEach(async ({ page, monitor }) => {
    test.skip(!isE2EDbReady(), skipReasonDbNotReady());
    test.skip(
      !enrollmentAuthoritativeEnabled(),
      "Skipped: set E2E_ENROLLMENT_AUTHORITATIVE=1 and FF_ENROLLMENT_ACCESS_MODE=enrollment on staging",
    );
    const creds = studentCreds();
    test.skip(!creds, skipReasonMissingCreds("student"));
    await loginAs(page, creds!, { monitor });
  });

  test("A: valid enrollment — My Courses → Course → Lesson opens", async ({ page, monitor }) => {
    monitor.noteAction("My Courses → Course A");
    await page.goto("/my-courses");
    await page.locator(`a[href="/courses/${COURSE_A}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`/courses/${COURSE_A}`));

    monitor.noteAction("Course A → owned lesson");
    await page.locator(`a[href="/learn/${LESSON_A}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`/learn/${LESSON_A}`));
    await expectLessonAllowed(page, LESSON_A, LESSON_A_TITLE);
  });

  test("E/F/L: lesson URL of an unowned course is denied", async ({ page, monitor }) => {
    monitor.noteAction(`Direct URL to unowned lesson ${DENY_LESSON}`);
    await expectLessonDenied(page, DENY_LESSON, DENY_LESSON_TITLE, NOT_ENROLLED);
  });

  test("G/K: multiple enrollments — Course A and Course B both open", async ({ page, monitor }) => {
    monitor.noteAction("Course A lesson");
    await expectLessonAllowed(page, LESSON_A, LESSON_A_TITLE);
    monitor.noteAction("Course B lesson (Checkout V2 seat)");
    await expectLessonAllowed(
      page,
      STAGING_FIXTURE.checkoutV2LessonId,
      STAGING_FIXTURE.checkoutV2LessonTitle,
    );
  });

  test("B/H/I: completed course replays even though the legacy subscription expired", async ({
    page,
    monitor,
  }) => {
    const f = ACCESS_FIXTURES.completed;
    monitor.noteAction(`Replay completed course lesson ${f.lessonId}`);
    await expectLessonAllowed(page, f.lessonId, f.lessonTitle);
  });

  test("D: refunded enrollment is denied", async ({ page, monitor }) => {
    const f = ACCESS_FIXTURES.refunded;
    monitor.noteAction(`Refunded course lesson ${f.lessonId}`);
    await expectLessonDenied(page, f.lessonId, f.lessonTitle, SEAT_CLOSED);
  });

  test("C: closed enrollment (accessOpen=false) is denied", async ({ page, monitor }) => {
    const f = ACCESS_FIXTURES.closed;
    monitor.noteAction(`Closed course lesson ${f.lessonId}`);
    await expectLessonDenied(page, f.lessonId, f.lessonTitle, SEAT_CLOSED);
  });

  test("J: active legacy subscription without enrollment is denied", async ({ page, monitor }) => {
    const f = ACCESS_FIXTURES.legacy;
    monitor.noteAction(`Legacy-only course lesson ${f.lessonId}`);
    await expectLessonDenied(page, f.lessonId, f.lessonTitle, NOT_ENROLLED);
  });
});

test.describe("Enrollment authoritative access — anonymous", () => {
  test("L: shared lesson URL without a session grants nothing", async ({ page, monitor }) => {
    test.skip(!isE2EDbReady(), skipReasonDbNotReady());
    test.skip(!enrollmentAuthoritativeEnabled(), "Skipped: E2E_ENROLLMENT_AUTHORITATIVE not set");
    monitor.noteAction(`Anonymous open of owned lesson ${LESSON_A}`);
    await page.goto(`/learn/${LESSON_A}`);
    const paywall = page.locator(".player-wrap.paywall");
    await expect(paywall).toBeVisible();
    await expect(paywall.getByRole("link", { name: "Kirish" })).toBeVisible();
    const api = await lessonApiStatus(page, LESSON_A);
    expect(api.chat).toBe(401);
    expect(api.recording).toBe(401);
  });
});
