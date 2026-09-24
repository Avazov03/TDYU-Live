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
 * Phase 5 Wave 3 — AppShell / home / navigation (browser).
 *   npm run test:e2e:shell
 */
test.describe("Student shell Enrollment-first", () => {
  test.beforeEach(() => {
    test.skip(!isE2EDbReady(), skipReasonDbNotReady());
  });

  test("Enrollment student lands in /app with shell nav", async ({ page, monitor }) => {
    const creds = studentCreds();
    test.skip(!creds, skipReasonMissingCreds("student"));
    await loginAs(page, creds!, { monitor });

    await expect(page).toHaveURL(/\/(app|onboard)/);
    await page.goto("/app");
    await expect(page.getByRole("heading", { name: /Nima qilish kerak/i })).toBeVisible();
    await expect(page.locator('a[href="/my-courses"]').first()).toBeVisible();
    await expect(page.locator('a[href="/schedule"]').first()).toBeVisible();
  });

  test("My Courses reachable from shell", async ({ page, monitor }) => {
    const creds = studentCreds();
    test.skip(!creds, skipReasonMissingCreds("student"));
    await loginAs(page, creds!, { monitor });

    await page.goto("/my-courses");
    await expect(page.locator(".lx-kicker").filter({ hasText: "Kurslarim" })).toBeVisible();
    await expect(page.getByText(STAGING_FIXTURE.courseTitle).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("Landing Kabinet CTA for enrolled student", async ({ page, monitor }) => {
    const creds = studentCreds();
    test.skip(!creds, skipReasonMissingCreds("student"));
    await loginAs(page, creds!, { monitor });

    await page.goto("/");
    await expect(page.getByRole("link", { name: /Kabinetga o'tish/i })).toBeVisible({
      timeout: 15_000,
    });
  });
});
