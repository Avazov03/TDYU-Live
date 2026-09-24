import { test, expect } from "../fixtures";
import { loginAs } from "../auth/login";
import {
  adminCreds,
  skipReasonMissingCreds,
  isE2EDbReady,
  skipReasonDbNotReady,
} from "../helpers/env";

test.describe("Admin smoke", () => {
  test.beforeEach(() => {
    test.skip(!isE2EDbReady(), skipReasonDbNotReady());
  });

  test("Admin can log in", async ({ page, monitor }) => {
    const creds = adminCreds();
    test.skip(!creds, skipReasonMissingCreds("admin"));
    await loginAs(page, creds!, { monitor, expectPath: /\/admin/ });
    await expect(page.locator("form [role='alert']")).toHaveCount(0);
  });

  test("Admin can open Admin Dashboard", async ({ adminPage, monitor }) => {
    monitor.noteAction("Goto /admin");
    await adminPage.goto("/admin");
    await expect(adminPage).toHaveURL(/\/admin/);
    await expect(adminPage.getByText("Boshqaruv").first()).toBeVisible();
    await expect(adminPage.getByRole("heading", { name: /Bugun platformada/i })).toBeVisible();
  });
});
