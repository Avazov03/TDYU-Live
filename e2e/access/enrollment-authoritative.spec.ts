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
/** Course B lesson — active1 may not be enrolled depending on prep. */
const COURSE_B_LESSON =
  process.env.E2E_CHECKOUT_V2_LESSON_ID?.trim() ||
  "b2500001-0000-4000-8000-000000000026";

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
    await expect(page.getByRole("link", { name: /Tarifni oshirish/i })).toHaveCount(0);
  });

  test("Direct lesson URL without enrollment is denied", async ({ page, monitor }) => {
    const creds = studentCreds();
    test.skip(!creds, skipReasonMissingCreds("student"));
    await loginAs(page, creds!, { monitor });

    // Course B lesson — must not be owned for this assertion (reset fixture seat before run).
    monitor.noteAction(`Probe foreign lesson ${COURSE_B_LESSON}`);
    await page.goto(`/learn/${COURSE_B_LESSON}`);
    await expect(page.getByRole("link", { name: /Tarifni oshirish/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel("Kurs progressi")).toHaveCount(0);
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
    await expect(page.getByRole("link", { name: /Tarifni oshirish/i })).toHaveCount(0);
  });
});
