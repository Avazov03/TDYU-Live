import { test, expect } from "../fixtures";
import { FLOW_FIXTURES as F, STAGING_FIXTURE } from "../helpers/test-data";
import { actor, anonymous, api, skipUnlessFlows } from "./flow-helpers";

/**
 * Assignment lifecycle: teacher creates → student submits with a file → file access matrix →
 * teacher grades → student sees the grade. Each run creates its own assignment.
 */

const PDF = "%PDF-1.4\n% e2e homework\n";

test.describe.serial("Assignments", () => {
  test.beforeEach(() => skipUnlessFlows());

  test("create, submit with file, grade — and who may open the file", async ({ teacherPage, browser, monitor }) => {
    const title = `E2E topshiriq ${Date.now()}`;
    const fileName = `hw-${Date.now()}.pdf`;
    const student = await actor(browser, F.users.assign1.email);
    const classmate = await actor(browser, F.users.assign2.email);
    const outsider = await actor(browser, STAGING_FIXTURE.studentEmail);
    const teacher2 = await actor(browser, F.users.teacher2.email, /\/teacher/);
    const admin = await actor(browser, STAGING_FIXTURE.adminEmail, /\/admin/);
    const anon = await anonymous(browser);
    try {
      monitor.noteAction("Teacher creates an assignment");
      await teacherPage.goto("/teacher/assignments");
      const trigger = teacherPage.getByRole("button", { name: "Yangi topshiriq" });
      if ((await trigger.getAttribute("aria-expanded")) === "false") await trigger.click();
      await teacherPage.locator(".field:has-text('Kurs') select").selectOption({ label: F.assignments.courseTitle });
      await teacherPage.locator(".field:has-text('Sarlavha') input").fill(title);
      await teacherPage.locator(".field:has-text('Tavsif') textarea").fill("Shartnoma tuzing va PDF yuklang.");
      const due = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 16);
      await teacherPage.locator("input[type=datetime-local]").fill(due);
      const created = teacherPage.waitForResponse(
        (r) => r.url().endsWith("/api/teacher/assignments") && r.request().method() === "POST",
      );
      await teacherPage.getByRole("button", { name: "Qo‘shish" }).click();
      const createdRes = await created;
      expect(createdRes.status()).toBe(201);
      const assignmentId = ((await createdRes.json()) as { assignment: { id: string } }).assignment.id;
      const card = teacherPage.getByTestId("teacher-assignment").filter({ hasText: title });
      await expect(card).toBeVisible();
      await expect(card).toContainText("Ochiq");
      await expect(card).toContainText("Topshirdi 0 / 2");

      monitor.noteAction("Student submits text + PDF");
      await student.page.goto("/assignments");
      const studentCard = student.page.getByTestId("assignment-card").filter({ hasText: title });
      await studentCard.getByRole("button", { name: "Javob yuborish" }).click();
      await studentCard.getByLabel("Javobingiz").fill("Shartnoma loyihasi ilova qilindi.");
      await studentCard.getByLabel(/Fayl biriktirish/).setInputFiles({
        name: fileName,
        mimeType: "application/pdf",
        buffer: Buffer.from(PDF),
      });
      const submitted = student.page.waitForResponse(
        (r) => r.url().endsWith("/api/assignments/submit") && r.request().method() === "POST",
      );
      await studentCard.getByRole("button", { name: "Topshirish" }).click();
      const submittedRes = await submitted;
      expect(submittedRes.status()).toBe(200);
      const submissionId = ((await submittedRes.json()) as { item: { id: string } }).item.id;
      await expect(studentCard).toContainText("Topshirilgan");

      monitor.noteAction("Student outside the course cannot submit");
      const foreign = await api(outsider.context, "POST", "/api/assignments/submit", {
        multipart: { assignmentId, text: "begona" },
      });
      expect(foreign.status).toBe(403);

      monitor.noteAction("Teacher sees the submission and its file");
      await teacherPage.reload();
      await expect(card).toContainText("Topshirdi 1 / 2");
      const fileLink = card.locator("a.lx-tas-file", { hasText: fileName });
      await expect(fileLink).toBeVisible();
      const href = (await fileLink.getAttribute("href"))!;
      expect(href).toMatch(/^\/uploads\/assignments\//);

      monitor.noteAction("File access matrix");
      const teacherGet = await api(teacherPage.context(), "GET", href);
      expect(teacherGet.status, "course teacher").toBe(200);
      expect(teacherGet.text).toBe(PDF);
      expect((await api(student.context, "GET", href)).status, "submitter").toBe(200);
      expect((await api(admin.context, "GET", href)).status, "admin").toBe(200);
      expect((await api(classmate.context, "GET", href)).status, "classmate").toBe(403);
      expect((await api(outsider.context, "GET", href)).status, "student of another course").toBe(403);
      expect((await api(teacher2.context, "GET", href)).status, "another teacher").toBe(403);
      expect((await api(anon, "GET", href)).status, "anonymous").toBe(401);

      monitor.noteAction("Another teacher cannot grade; teacher grades 87");
      const foreignGrade = await api(teacher2.context, "POST", "/api/teacher/grades", { submissionId, grade: 100 });
      expect(foreignGrade.status).toBe(404);
      const sub = card.locator(".lx-tas-sub", { hasText: F.users.assign1.name });
      await sub.locator("input[placeholder='Baho']").fill("87");
      await sub.locator("input[placeholder='Izoh']").fill("Yaxshi, lekin 3-bandni kengaytiring");
      await sub.getByRole("button", { name: "Saqlash" }).click();
      await expect(card).toContainText("Hammasi baholangan");

      monitor.noteAction("Student sees the grade and note");
      await student.page.reload();
      await expect(studentCard.locator(".lx-as-grade")).toContainText("87");
      await expect(studentCard.locator(".lx-as-note")).toContainText("3-bandni kengaytiring");

      monitor.noteAction("Teacher cannot create assignments on another teacher's course; students cannot create");
      const body = { courseId: F.otherTeacherCourse.courseId, titleUz: "Begona", descriptionUz: "Begona", dueAt: due };
      expect((await api(teacherPage.context(), "POST", "/api/teacher/assignments", body)).status).toBe(404);
      expect(
        (await api(student.context, "POST", "/api/teacher/assignments", { ...body, courseId: F.assignments.courseId })).status,
      ).toBe(403);

      for (const a of [student, classmate, outsider, teacher2, admin]) await a.done();
    } finally {
      for (const c of [student.context, classmate.context, outsider.context, teacher2.context, admin.context, anon]) {
        await c.close().catch(() => undefined);
      }
    }
  });
});
