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
 * Phase 5 Wave 2 — Enrollment-first student catalog (browser).
 * Run with smoke or: npm run test:e2e -- e2e/catalog
 * Requires E2E_DB_READY=1 and staging/local fixtures.
 */
test.describe("Student catalog Enrollment-first", () => {
  test.beforeEach(() => {
    test.skip(!isE2EDbReady(), skipReasonDbNotReady());
  });

  test("My Courses shows enrolled course", async ({ page, monitor }) => {
    const creds = studentCreds();
    test.skip(!creds, skipReasonMissingCreds("student"));
    await loginAs(page, creds!, { monitor });

    await page.goto("/my-courses");
    await expect(page.locator(".lx-kicker").filter({ hasText: "Kurslarim" })).toBeVisible();
    await expect(page.getByText(STAGING_FIXTURE.courseTitle).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("Dashboard course count reflects owned seats", async ({ page, monitor }) => {
    const creds = studentCreds();
    test.skip(!creds, skipReasonMissingCreds("student"));
    await loginAs(page, creds!, { monitor });

    await page.goto("/app");
    await expect(page.getByRole("heading", { name: /Nima qilish kerak/i })).toBeVisible();
    await expect(page.getByText(/\d+\s+ta kurs/i).first()).toBeVisible();
  });

  test("Non-owned Checkout V2 course is not listed as My Courses card", async ({
    page,
    monitor,
  }) => {
    const creds = studentCreds();
    test.skip(!creds, skipReasonMissingCreds("student"));
    await loginAs(page, creds!, { monitor });

    await page.goto("/my-courses");
    await expect(page.getByText(STAGING_FIXTURE.courseTitle).first()).toBeVisible();
    // Course B seat was closed for Wave 1 deny fixture — must not appear as owned title.
    await expect(page.getByText(STAGING_FIXTURE.checkoutV2CourseTitle)).toHaveCount(0);
  });

  test("Lesson navigation still works for owned course", async ({ page, monitor }) => {
    const creds = studentCreds();
    test.skip(!creds, skipReasonMissingCreds("student"));
    await loginAs(page, creds!, { monitor });

    const res = await page.goto(`/learn/${STAGING_FIXTURE.lessonId}`);
    expect(res?.status(), "lesson HTTP").toBeLessThan(500);
    await expect(
      page.getByRole("heading", { level: 2, name: STAGING_FIXTURE.lessonTitle }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Tarifni oshirish|Kurslarni ko/i })).toHaveCount(0);
  });
});
