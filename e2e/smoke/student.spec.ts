import { test, expect } from "../fixtures";
import { loginAs } from "../auth/login";
import {
  studentCreds,
  skipReasonMissingCreds,
  isE2EDbReady,
  skipReasonDbNotReady,
} from "../helpers/env";
import { SEED } from "../helpers/test-data";

test.describe("Student smoke", () => {
  test.beforeEach(() => {
    test.skip(!isE2EDbReady(), skipReasonDbNotReady());
  });

  test("Student can log in", async ({ page, monitor }) => {
    const creds = studentCreds();
    test.skip(!creds, skipReasonMissingCreds("student"));
    await loginAs(page, creds!, { monitor });
    await expect(page).toHaveURL(/\/(app|onboard)/);
    await expect(page.locator("form [role='alert']")).toHaveCount(0);
  });

  test("Student can open dashboard", async ({ studentPage, monitor }) => {
    monitor.noteAction("Goto /app");
    await studentPage.goto("/app");
    await expect(studentPage).toHaveURL(/\/app/);
    await expect(studentPage.getByRole("heading", { name: /Nima qilish kerak/i })).toBeVisible();
    await expect(studentPage.getByText(/ta kurs/i).first()).toBeVisible();
  });

  test("Student can open My Courses", async ({ studentPage, monitor }) => {
    monitor.noteAction('Click nav link to /my-courses');
    // Desktop notch may render icon-only links without visible "Kurslarim" text.
    await studentPage.locator('a[href="/my-courses"]').first().click();
    await expect(studentPage).toHaveURL(/\/my-courses/);
    // Prefer page kicker (sidebar also has a hidden "Kurslarim" span).
    await expect(studentPage.locator(".lx-kicker").filter({ hasText: "Kurslarim" })).toBeVisible();
    await expect(
      studentPage.getByRole("heading", { name: /O'qituvchi, keyin uning kurslari/i }),
    ).toBeVisible();
    await expect(studentPage.getByText(SEED.courseTitleCivil).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("Student can open an enrolled course", async ({ studentPage, monitor }) => {
    monitor.noteAction("Goto /my-courses");
    await studentPage.goto("/my-courses");
    await expect(studentPage.locator(".lx-kicker").filter({ hasText: "Kurslarim" })).toBeVisible();
    monitor.noteAction(`Open course ${SEED.courseTitleCivil}`);
    await studentPage.locator(`a[href="/courses/${SEED.courseCivilBasics}"]`).first().click();
    await expect(studentPage).toHaveURL(new RegExp(`/courses/${SEED.courseCivilBasics}`));
    await expect(studentPage.getByText(SEED.courseTitleCivil).first()).toBeVisible();
    await expect(studentPage.getByRole("heading", { name: "Sizning obunangiz" })).toBeVisible();
    await expect(studentPage.getByRole("heading", { name: "Darslar" })).toBeVisible();
  });

  test("Student can open a lesson", async ({ studentPage, monitor }) => {
    monitor.noteAction(`Goto /learn/${SEED.lessonIntro}`);
    const res = await studentPage.goto(`/learn/${SEED.lessonIntro}`);
    expect(res?.status(), "lesson HTTP status").toBeLessThan(500);
    if (res?.status() === 404) {
      test.skip(true, `Lesson ${SEED.lessonIntro} not found. Seed DB or set E2E_LESSON_ID.`);
      return;
    }
    await expect(
      studentPage.getByRole("heading", { level: 2, name: SEED.lessonTitleIntro }),
    ).toBeVisible();
    await expect(studentPage.getByLabel("Kurs progressi")).toBeVisible();
  });

  test("Student can navigate back correctly", async ({ studentPage, monitor }) => {
    monitor.noteAction("Goto lesson then back via Kurslarim");
    await studentPage.goto(`/learn/${SEED.lessonIntro}`);
    await expect(
      studentPage.getByRole("heading", { level: 2, name: SEED.lessonTitleIntro }),
    ).toBeVisible();

    await studentPage.locator('a[href="/my-courses"]').first().click();
    await expect(studentPage).toHaveURL(/\/my-courses/);
    await expect(
      studentPage.getByRole("heading", { name: /O'qituvchi, keyin uning kurslari/i }),
    ).toBeVisible();
  });

  test("Student can open search", async ({ studentPage, monitor }) => {
    const q = encodeURIComponent(SEED.courseTitleCivil.split(/\s+/)[0] || "Fixture");
    monitor.noteAction(`Goto /search?q=${q}`);
    await studentPage.goto(`/search?q=${q}`);
    await expect(studentPage).toHaveURL(/\/search/);
    await expect(studentPage.getByRole("heading", { name: /natijalari|Kurs yoki/i })).toBeVisible();
  });
});
