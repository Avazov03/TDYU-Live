import { test, expect } from "../fixtures";
import { loginAs } from "../auth/login";
import { isE2EDbReady, skipReasonDbNotReady, studentCreds, skipReasonMissingCreds } from "../helpers/env";
import { expectHealthyPage } from "../helpers/page-health";

/**
 * Phone viewport (mobile project): page health on public and student pages, nav reachable via the drawer.
 */

test.describe("Mobile layout", () => {
  for (const path of ["/", "/login", "/register"]) {
    test(`public ${path} fits the phone screen`, async ({ page, monitor }) => {
      monitor.noteAction(`Goto ${path}`);
      await page.goto(path);
      await expectHealthyPage(page, path);
    });
  }

  test("student pages fit and the drawer reaches navigation", async ({ page, monitor }) => {
    test.skip(!isE2EDbReady(), skipReasonDbNotReady());
    const creds = studentCreds();
    test.skip(!creds, skipReasonMissingCreds("student"));
    await loginAs(page, creds!, { monitor });

    for (const path of ["/app", "/my-courses", "/schedule", "/assignments", "/certificates", "/settings"]) {
      monitor.noteAction(`Goto ${path}`);
      await page.goto(path);
      await expectHealthyPage(page, path);
    }

    monitor.noteAction("Open the mobile menu and navigate");
    await page.goto("/app");
    await page.getByRole("button", { name: "Menyu" }).locator("visible=true").first().click();
    const link = page.locator('a[href="/my-courses"]').locator("visible=true").first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/my-courses/);
  });
});
