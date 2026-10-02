import { test, expect } from "../fixtures";
import { FLOW_FIXTURES as F, STAGING_FIXTURE } from "../helpers/test-data";
import { actor, api, skipUnlessFlows } from "./flow-helpers";

/**
 * Refund flows (FF_REFUNDS_V1): admin 50% special refund and teacher cancel-before-start (100%).
 * One-shot per seed — runs only in the hermetic suite (E2E_FLOWS=1).
 */

const ADMIN = STAGING_FIXTURE.adminEmail;
const TEACHER = STAGING_FIXTURE.teacherEmail;
const REASON = "E2E: talaba iltimosiga ko'ra qaytarildi";

test.describe.serial("Refunds", () => {
  test.beforeEach(() => skipUnlessFlows());

  test("admin 50% refund closes the student's seat, keeps their other course", async ({ browser, monitor }) => {
    const admin = await actor(browser, ADMIN, /\/admin/);
    const student = await actor(browser, F.users.refund1.email);
    try {
      monitor.noteAction("Admin opens payments and finds the refund row");
      await admin.page.goto("/admin/payments");
      const range = admin.page.locator("select.staff-filter");
      if (await range.count()) await range.first().selectOption("all");
      const row = admin.page.locator("tr", { hasText: F.users.refund1.name }).filter({ hasText: F.refund.courseTitle });
      const cell = row.getByTestId("refund-eligible");
      await expect(cell).toBeVisible();

      monitor.noteAction("Student and teacher cannot call the admin refund API");
      const url = `/api/admin/purchases/${F.refund.purchaseId}/refund`;
      expect((await api(student.context, "POST", url, { reason: REASON })).status).toBe(403);

      monitor.noteAction("Admin issues the 50% refund");
      await cell.getByRole("button", { name: "50% qaytarish" }).click();
      await expect(cell).toContainText("O‘tilgan: 33%");
      await cell.getByLabel("Qaytarish asosi").fill(REASON);
      await cell.getByRole("button", { name: "50% qaytarish" }).last().click();
      const done = row.getByTestId("refund-done");
      await expect(done).toContainText("50% qaytarilgan");
      await expect(done).toContainText(/100\s000 so'm/);

      monitor.noteAction("Second refund of the same purchase is refused");
      expect((await api(admin.context, "POST", url, { reason: REASON })).status).toBe(409);
      monitor.noteAction("Legacy backfill purchase is not refundable");
      const legacy = await api(admin.context, "POST", "/api/admin/purchases/83c4d585-403d-4b5b-b8c7-67efcb3cee77/refund", {
        reason: REASON,
      });
      expect(legacy.status).toBe(409);

      monitor.noteAction("Student: refunded course gone from My Courses, other course stays");
      await student.page.goto("/my-courses");
      await expect(student.page.locator(`a[href="/courses/${F.keep.courseId}"]`).first()).toBeVisible();
      await expect(student.page.locator(`a[href="/courses/${F.refund.courseId}"]`)).toHaveCount(0);

      monitor.noteAction("Student: refunded course lesson shows the closed-seat paywall");
      await student.page.goto(`/learn/${F.refund.lessonId}`);
      const paywall = student.page.locator(".player-wrap.paywall");
      await expect(paywall).toBeVisible();
      await expect(paywall.getByText(/kirish yopilgan/i)).toBeVisible();
      expect((await api(student.context, "GET", `/api/lessons/${F.refund.lessonId}/chat`)).status).toBe(403);

      await admin.done();
      await student.done();
    } finally {
      await admin.context.close().catch(() => undefined);
      await student.context.close().catch(() => undefined);
    }
  });

  test("teacher cancels an upcoming course: buyer refunded 100%, seat closed", async ({
    teacherPage,
    browser,
    monitor,
  }) => {
    const student = await actor(browser, F.users.cancel1.email);
    try {
      monitor.noteAction("Student cannot cancel the course");
      const cancelUrl = `/api/teacher/courses/${F.cancel.courseId}/cancel`;
      expect((await api(student.context, "POST", cancelUrl, { reason: REASON })).status).toBe(403);

      monitor.noteAction("Teacher cancels the upcoming course from the studio card");
      await teacherPage.goto("/teacher");
      const card = teacherPage.locator("article.lx-tc-card", {
        has: teacherPage.locator("h3.lx-tc-title", { hasText: F.cancel.courseTitle }),
      });
      const box = card.getByTestId("course-cancel");
      await box.getByRole("button", { name: "Kursni bekor qilish" }).click();
      await expect(box).toContainText("1 ta xaridor");
      await box.getByLabel("Bekor qilish sababi").fill("E2E: kurs ochilmaydi, guruh yig'ilmadi");
      await box.getByRole("button", { name: "Ha, bekor qilish" }).click();
      await expect(card).toContainText("Bekor qilingan");

      monitor.noteAction("Admin payments show the 100% cancellation refund");
      const admin = await actor(browser, ADMIN, /\/admin/);
      await admin.page.goto("/admin/payments");
      const range = admin.page.locator("select.staff-filter");
      if (await range.count()) await range.first().selectOption("all");
      const row = admin.page.locator("tr", { hasText: F.users.cancel1.name }).filter({ hasText: F.cancel.courseTitle });
      await expect(row.getByTestId("refund-done")).toContainText("Kurs bekor — 100% qaytarilgan");
      await expect(row.getByTestId("refund-done")).toContainText(/150\s000 so'm/);
      await admin.done();

      monitor.noteAction("Student: cancelled course gone from My Courses");
      await student.page.goto("/my-courses");
      await expect(student.page.locator(`a[href="/courses/${F.keep.courseId}"]`).first()).toBeVisible();
      await expect(student.page.locator(`a[href="/courses/${F.cancel.courseId}"]`)).toHaveCount(0);
      await student.done();
    } finally {
      await student.context.close().catch(() => undefined);
    }
  });
});

test.describe("Refunds — teacher scope", () => {
  test("teacher cannot issue an admin refund", async ({ browser }) => {
    skipUnlessFlows();
    const teacher = await actor(browser, TEACHER, /\/teacher/);
    try {
      const res = await api(teacher.context, "POST", `/api/admin/purchases/${F.refund.purchaseId}/refund`, {
        reason: REASON,
      });
      expect(res.status).toBe(403);
    } finally {
      await teacher.context.close();
    }
  });
});
