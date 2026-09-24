import { test, expect } from "../fixtures";
import { loginAs } from "../auth/login";
import {
  isE2EDbReady,
  skipReasonDbNotReady,
  studentCreds,
  skipReasonMissingCreds,
} from "../helpers/env";
import { STAGING_FIXTURE } from "../helpers/test-data";

/**
 * Phase 5 Wave 1 — Enrollment-authoritative browser checks.
 *
 * NOT part of `test:e2e:smoke` (keeps 18/0/0 smoke suite stable).
 * Run with:
 *   E2E_DB_READY=1 E2E_ENROLLMENT_AUTHORITATIVE=1 npm run test:e2e:access
 *
 * Staging must have FF_ENROLLMENT_ACCESS_MODE=enrollment (via start-staging.sh /.env).
 */
function enrollmentAuthoritativeEnabled() {
  const v = process.env.E2E_ENROLLMENT_AUTHORITATIVE?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

const COURSE_A = STAGING_FIXTURE.courseId;
const LESSON_A = STAGING_FIXTURE.lessonId;
const LESSON_A_TITLE = STAGING_FIXTURE.lessonTitle;
/** Unowned deny probe — never purchased by fixture.active1. */
const DENY_LESSON =
  process.env.E2E_DENY_LESSON_ID?.trim() || STAGING_FIXTURE.denyLessonId;

test.describe("Enrollment authoritative access", () => {
  test.beforeEach(() => {
    test.skip(!isE2EDbReady(), skipReasonDbNotReady());
    test.skip(
      !enrollmentAuthoritativeEnabled(),
      "Skipped: set E2E_ENROLLMENT_AUTHORITATIVE=1 and FF_ENROLLMENT_ACCESS_MODE=enrollment on staging",
    );
  });

  test("Enrolled student can open owned lesson", async ({ page, monitor }) => {
    const creds = studentCreds();
    test.skip(!creds, skipReasonMissingCreds("student"));
    await loginAs(page, creds!, { monitor });

    monitor.noteAction("My Courses → owned lesson");
    await page.goto("/my-courses");
    await expect(page.getByText(STAGING_FIXTURE.courseTitle).first()).toBeVisible();

    const res = await page.goto(`/learn/${LESSON_A}`);
    expect(res?.status(), "lesson HTTP").toBeLessThan(500);
    await expect(
      page.getByRole("heading", { level: 2, name: LESSON_A_TITLE }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Tarifni oshirish|Kurslarni ko/i })).toHaveCount(0);
  });

  test("Direct lesson URL without enrollment is denied", async ({ page, monitor }) => {
    const creds = studentCreds();
    test.skip(!creds, skipReasonMissingCreds("student"));
    await loginAs(page, creds!, { monitor });

    // Deny probe course — must never be owned by fixture.active1.
    monitor.noteAction(`Probe foreign lesson ${DENY_LESSON}`);
    await page.goto(`/learn/${DENY_LESSON}`);
    // Paywall CTA; progress chrome may still render around the deny state.
    await expect(page.getByRole("link", { name: /Tarifni oshirish|Kurslarni ko/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/yozilmagansiz|Obuna muddati|tizimga kiring/i).first()).toBeVisible();
  });

  test("Course A lesson stays accessible (multi-course)", async ({ page, monitor }) => {
    const creds = studentCreds();
    test.skip(!creds, skipReasonMissingCreds("student"));
    await loginAs(page, creds!, { monitor });
    monitor.noteAction(`Course A lesson ${COURSE_A}`);
    await page.goto(`/learn/${LESSON_A}`);
    await expect(
      page.getByRole("heading", { level: 2, name: LESSON_A_TITLE }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Tarifni oshirish|Kurslarni ko/i })).toHaveCount(0);
  });
});
