import { test, expect } from "../fixtures";
import { loginAs } from "../auth/login";
import {
  teacherCreds,
  skipReasonMissingCreds,
  isE2EDbReady,
  skipReasonDbNotReady,
} from "../helpers/env";

test.describe("Teacher smoke", () => {
  test.beforeEach(() => {
    test.skip(!isE2EDbReady(), skipReasonDbNotReady());
  });

  test("Teacher can log in", async ({ page, monitor }) => {
    const creds = teacherCreds();
    test.skip(!creds, skipReasonMissingCreds("teacher"));
    await loginAs(page, creds!, { monitor, expectPath: /\/teacher/ });
    await expect(page.locator("form [role='alert']")).toHaveCount(0);
  });

  test("Teacher can open Teacher Dashboard", async ({ teacherPage, monitor }) => {
    monitor.noteAction("Goto /teacher");
    await teacherPage.goto("/teacher");
    await expect(teacherPage).toHaveURL(/\/teacher/);
    await expect(teacherPage.getByText("Studio").first()).toBeVisible();
    await expect(teacherPage.getByRole("heading", { name: /Salom,/i })).toBeVisible();
  });
});
