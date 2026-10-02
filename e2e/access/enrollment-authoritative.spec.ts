import type { BrowserContext, Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { loginAs } from "../auth/login";
import {
  isE2EDbReady,
  skipReasonDbNotReady,
  studentCreds,
  teacherCreds,
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

  test("G/K: multiple enrollments — Course A and a second course both open", async ({ page, monitor }) => {
    monitor.noteAction("Course A lesson");
    await expectLessonAllowed(page, LESSON_A, LESSON_A_TITLE);
    const f = ACCESS_FIXTURES.second;
    monitor.noteAction(`Second active seat lesson ${f.lessonId}`);
    await expectLessonAllowed(page, f.lessonId, f.lessonTitle);
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

/** Status + body of a gated upload URL, opened in a fresh tab of the given context. */
async function fileStatus(context: BrowserContext, fileUrl: string) {
  const probe = await context.newPage();
  try {
    const res = await probe.goto(fileUrl);
    return { status: res?.status() ?? 0, body: (await res?.text().catch(() => "")) ?? "" };
  } finally {
    await probe.close();
  }
}

test.describe("Enrollment authoritative access — lesson materials", () => {
  test("M: material file downloads only for enrolled students and staff", async ({
    page,
    monitor,
    browser,
  }) => {
    test.skip(!isE2EDbReady(), skipReasonDbNotReady());
    test.skip(!enrollmentAuthoritativeEnabled(), "Skipped: E2E_ENROLLMENT_AUTHORITATIVE not set");
    const student = studentCreds();
    const teacher = teacherCreds();
    test.skip(!student, skipReasonMissingCreds("student"));
    test.skip(!teacher, skipReasonMissingCreds("teacher"));

    const baseURL = test.info().project.use.baseURL;
    const teacherCtx = await browser.newContext({ baseURL });
    const anonCtx = await browser.newContext({ baseURL });
    const teacherPage = await teacherCtx.newPage();
    const marker = `e2e-material-${Date.now()}`;
    const uploaded: { lessonId: string; assetId: string }[] = [];

    try {
      monitor.noteAction("Teacher uploads a material to an owned and an unowned lesson");
      await loginAs(teacherPage, teacher!, { expectPath: /\/teacher/ });
      const upload = (lessonId: string) =>
        teacherPage.evaluate(
          async ({ lessonId, marker }) => {
            const form = new FormData();
            form.append("file", new File([marker], `${marker}.txt`, { type: "text/plain" }));
            const res = await fetch(`/api/teacher/lessons/${lessonId}/assets`, {
              method: "POST",
              body: form,
            });
            const data = await res.json();
            return { status: res.status, id: data.item?.id as string, fileUrl: data.item?.fileUrl as string };
          },
          { lessonId, marker },
        );
      const owned = await upload(LESSON_A);
      expect(owned.status, "upload to Course A lesson").toBe(200);
      uploaded.push({ lessonId: LESSON_A, assetId: owned.id });
      const unowned = await upload(DENY_LESSON);
      expect(unowned.status, "upload to deny-probe lesson").toBe(200);
      uploaded.push({ lessonId: DENY_LESSON, assetId: unowned.id });
      expect(owned.fileUrl).toMatch(/^\/uploads\/lessons\//);

      monitor.noteAction("Teacher (course owner) can open both files");
      expect((await fileStatus(teacherCtx, owned.fileUrl)).status).toBe(200);
      expect((await fileStatus(teacherCtx, unowned.fileUrl)).status).toBe(200);

      monitor.noteAction("Enrolled student opens the Course A material");
      await loginAs(page, student!, { monitor });
      const mine = await fileStatus(page.context(), owned.fileUrl);
      expect(mine.status, "enrolled student download").toBe(200);
      expect(mine.body).toBe(marker);

      monitor.noteAction("Student without enrollment is refused the other material");
      expect((await fileStatus(page.context(), unowned.fileUrl)).status).toBe(403);

      monitor.noteAction("Anonymous visitor is refused");
      expect((await fileStatus(anonCtx, owned.fileUrl)).status).toBe(401);
    } finally {
      for (const a of uploaded) {
        if (!a.assetId) continue;
        await teacherPage
          .evaluate(
            ({ lessonId, assetId }) =>
              fetch(`/api/teacher/lessons/${lessonId}/assets/${assetId}`, { method: "DELETE" }).then(
                (r) => r.status,
              ),
            a,
          )
          .catch(() => 0);
      }
      await teacherCtx.close();
      await anonCtx.close();
    }
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
