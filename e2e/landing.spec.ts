import { test, expect } from "@playwright/test";

test.describe("Lexify landing", () => {
  test("hero shows Lexify as primary brand signal", async ({ page }) => {
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

  test("tariflar section is reachable", async ({ page }) => {
    await page.goto("/#tariflar");
    await expect(page.locator("#tariflar")).toBeVisible();
  });
});
