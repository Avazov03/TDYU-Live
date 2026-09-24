import { test, expect } from "./fixtures";

/**
 * Landing smoke kept from the original suite.
 * Uses the shared monitor so critical console/network failures fail the test.
 */
test.describe("Lexify landing", () => {
  test("hero shows Lexify as primary brand signal", async ({ page, monitor }) => {
    monitor.noteAction("Goto /");
    await page.goto("/");
    await expect(page).toHaveTitle(/Lexify/i);

    const heroName = page.locator(".site-hero-name");
    await expect(heroName).toBeVisible();
    await expect(heroName).toHaveText(/Lexify/i);

    await expect(page.locator(".site-hero-tag")).toContainText(
      "TDYU professorlaridan jonli huquqiy kurslar",
    );
    await expect(page.locator(".site-hero-lead")).toBeVisible();
    await expect(page.locator(".site-hero-cta .btn").first()).toBeVisible();
  });

  test("notch navbar links to landing sections", async ({ page, monitor }) => {
    monitor.noteAction("Goto /");
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Qanday" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Loyiha" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Tariflar" }).first()).toBeVisible();
  });
});
