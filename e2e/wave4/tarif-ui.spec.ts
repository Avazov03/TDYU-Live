import { test, expect } from "../fixtures";
import {
  isE2EDbReady,
  skipReasonDbNotReady,
} from "../helpers/env";

/**
 * Phase 5 Wave 4 — Tarif UI hidden under enrollment mode.
 *   npm run test:e2e:wave4
 */
test.describe("Wave 4 Tarif UI migration", () => {
  test.beforeEach(() => {
    test.skip(!isE2EDbReady(), skipReasonDbNotReady());
  });

  test("Landing does not show Tariflar nav or T1/T2/T3 pricing grid", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: /Asosiy menyu/i }).getByRole("link", { name: /^Tariflar$/i })).toHaveCount(0);
    await expect(page.getByTestId("landing-course-cta")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/O'zingizga mos tarifni tanlang/i)).toHaveCount(0);
  });
});
