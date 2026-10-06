import { test } from "../fixtures";
import { expectHealthyPage } from "../helpers/page-health";
import { SEED, STAGING_FIXTURE } from "../helpers/test-data";

/**
 * Desktop page health for every role's main pages (read-only): overflow, duplicate ids,
 * unnamed controls, unlabeled fields, images without alt. Problems are listed per page.
 */

test.describe("Page health — desktop", () => {
  test("public pages", async ({ page, monitor }) => {
    for (const path of ["/", "/login", "/register", "/reset-password", `/courses/${SEED.courseCivilBasics}`]) {
      monitor.noteAction(`Goto ${path}`);
      await page.goto(path);
      await expectHealthyPage(page, path);
    }
  });

  test("student pages", async ({ studentPage: page, monitor }) => {
    for (const path of [
      "/app",
      "/my-courses",
      "/schedule",
      "/assignments",
      "/certificates",
      "/settings",
      `/learn/${STAGING_FIXTURE.lessonId}`,
    ]) {
      monitor.noteAction(`Goto ${path}`);
      await page.goto(path);
      await expectHealthyPage(page, path);
    }
  });

  test("teacher pages", async ({ teacherPage: page, monitor }) => {
    for (const path of ["/teacher", "/teacher/group", "/teacher/reja", "/settings"]) {
      monitor.noteAction(`Goto ${path}`);
      await page.goto(path);
      await expectHealthyPage(page, path);
    }
    monitor.noteAction("Goto /teacher/assignments with the create form open");
    await page.goto("/teacher/assignments");
    const trigger = page.getByRole("button", { name: "Yangi topshiriq" });
    if ((await trigger.getAttribute("aria-expanded")) === "false") await trigger.click();
    await expectHealthyPage(page, "/teacher/assignments (form open)");
  });

  test("admin pages", async ({ adminPage: page, monitor }) => {
    for (const path of [
      "/admin",
      "/admin/users",
      "/admin/teachers",
      "/admin/courses",
      "/admin/payments",
      "/admin/review",
      "/admin/certificates",
    ]) {
      monitor.noteAction(`Goto ${path}`);
      await page.goto(path);
      await expectHealthyPage(page, path);
    }
  });
});
