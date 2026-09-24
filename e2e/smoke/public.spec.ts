import { test, expect } from "../fixtures";
import { SEED } from "../helpers/test-data";
import { isE2EDbReady, skipReasonDbNotReady } from "../helpers/env";

test.describe("Public smoke", () => {
  test("Homepage loads without critical browser errors", async ({ page, monitor }) => {
    monitor.noteAction("Goto /");
    await page.goto("/");
    await expect(page).toHaveTitle(/Lexify/i);
    await expect(page.locator(".site-hero-name")).toBeVisible();
    await expect(page.locator(".site-hero-name")).toHaveText(/Lexify/i);
  });

  test("Login page loads", async ({ page, monitor }) => {
    monitor.noteAction("Goto /login");
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /Xush kelibsiz/i })).toBeVisible();
    await expect(page.locator("#login-email")).toBeVisible();
    await expect(page.locator("#login-password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Kirish", exact: true })).toBeVisible();
  });

  test("Unauthenticated search redirects to login", async ({ page, monitor }) => {
    // /search requires an authenticated app user — public entry should bounce to login.
    monitor.noteAction("Goto /search");
    await page.goto("/search");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: /Xush kelibsiz/i })).toBeVisible();
  });

  test("Course detail opens without application errors", async ({ page, monitor }) => {
    test.skip(!isE2EDbReady(), skipReasonDbNotReady());

    monitor.noteAction(`Goto /courses/${SEED.courseCivilBasics}`);
    const res = await page.goto(`/courses/${SEED.courseCivilBasics}`);
    expect(res?.status(), "course detail HTTP status").toBeLessThan(500);

    if (res?.status() === 404) {
      test.skip(
        true,
        `Course ${SEED.courseCivilBasics} not found. Run npm run db:e2e-seed locally or set E2E_COURSE_ID.`,
      );
      return;
    }

    await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
    await expect(page.getByText(SEED.courseTitleCivil).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Darslar" })).toBeVisible();
  });
});
