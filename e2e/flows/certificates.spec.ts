import { test, expect } from "../fixtures";
import { FLOW_FIXTURES as F, STAGING_FIXTURE } from "../helpers/test-data";
import { actor, anonymous, api, open, skipUnlessFlows } from "./flow-helpers";

/**
 * Course completion (FF_COURSE_COMPLETION_V1) and teacher-uploaded certificates:
 * issue → student view/download → access matrix → revoke → student loses access.
 */

const PDF = "%PDF-1.4\n% e2e certificate\n";
const pdfFile = (name = "sertifikat.pdf") => ({ name, type: "application/pdf", text: PDF });

test.describe.serial("Course completion and certificates", () => {
  test.beforeEach(() => skipUnlessFlows());

  test("teacher completes a course; the student's seat becomes completed", async ({ teacherPage, browser, monitor }) => {
    monitor.noteAction("Teacher completes the course from the studio card");
    await teacherPage.goto("/teacher");
    const card = teacherPage.locator("article.lx-tc-card", {
      has: teacherPage.locator("h3.lx-tc-title", { hasText: F.completion.courseTitle }),
    });
    const box = card.getByTestId("course-complete");
    await box.getByRole("button", { name: "Kursni yakunlash" }).click();
    await box.getByRole("group", { name: "Kursni yakunlash" }).getByRole("button", { name: "Ha, yakunlash" }).click();
    await expect(card).toContainText("Yakunlangan");

    monitor.noteAction("Student sees the course as completed, replay stays open");
    const student = await actor(browser, F.users.cert1.email);
    try {
      await student.page.goto("/my-courses");
      await expect(
        student.page.getByTestId("my-course-completed").filter({ hasText: F.completion.courseTitle }),
      ).toBeVisible();
      await student.done();
    } finally {
      await student.context.close().catch(() => undefined);
    }
  });

  test("issue, view, download and revoke a certificate", async ({ teacherPage, browser, monitor }) => {
    const owner = await actor(browser, F.users.cert1.email);
    const outsider = await actor(browser, STAGING_FIXTURE.studentEmail);
    const teacher2 = await actor(browser, F.users.teacher2.email, /\/teacher/);
    const admin = await actor(browser, STAGING_FIXTURE.adminEmail, /\/admin/);
    const anon = await anonymous(browser);
    const teacherCtx = teacherPage.context();
    try {
      monitor.noteAction("Server-side issue rules");
      const issue = (userId: string, file = pdfFile()) =>
        api(teacherCtx, "POST", "/api/teacher/certificates", {
          multipart: { courseId: F.certificate.courseId, userId, file },
        });
      expect((await issue(F.users.cert1.id, { name: "s.txt", type: "text/plain", text: "not a pdf" })).status).toBe(422);
      expect((await issue(STAGING_FIXTURE.studentId)).status, "student without a seat").toBe(409);

      monitor.noteAction("Teacher issues the certificate from the group page");
      await teacherPage.goto("/teacher/group");
      await teacherPage.getByRole("tab", { name: /Barchasi/ }).click();
      const duplicateIds = await teacherPage.evaluate(() => {
        const seen = new Map<string, number>();
        for (const el of document.querySelectorAll("[id]")) seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
        return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
      });
      expect(duplicateIds, "label/aria references need unique ids").toEqual([]);
      const section = teacherPage.locator("section.lx-grp-course", {
        has: teacherPage.locator("h2", { hasText: F.certificate.courseTitle }),
      });
      const row = section.getByTestId("group-student").filter({ hasText: F.users.cert1.name });
      await row.getByTestId("certificate-issue").click();
      const issueDialog = teacherPage.locator("dialog[open]");
      await expect(issueDialog).toContainText(F.users.cert1.name);
      await issueDialog.getByLabel(/Sertifikat fayli/).setInputFiles({
        name: "sertifikat.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from(PDF),
      });
      const issued = teacherPage.waitForResponse(
        (r) => r.url().endsWith("/api/teacher/certificates") && r.request().method() === "POST",
      );
      await issueDialog.getByTestId("certificate-confirm").click();
      const issuedRes = await issued;
      expect(issuedRes.status()).toBe(200);
      const certId = ((await issuedRes.json()) as { certificate: { id: string } }).certificate.id;
      await expect(row.getByTestId("certificate-issued")).toBeVisible();
      expect((await issue(F.users.cert1.id)).status, "already issued").toBe(409);

      monitor.noteAction("Student sees and opens the certificate");
      await owner.page.goto("/certificates");
      const certCard = owner.page.getByTestId("certificate-card").filter({ hasText: F.certificate.courseTitle });
      await certCard.click();
      await expect(owner.page.getByTestId("certificate-view")).toBeVisible();
      await expect(owner.page.locator("iframe.lx-cert-frame")).toBeVisible();
      await expect(owner.page.getByTestId("certificate-download")).toHaveAttribute(
        "href",
        `/api/certificates/${certId}/file?download=1`,
      );

      monitor.noteAction("Certificate file access matrix");
      const file = `/api/certificates/${certId}/file`;
      const ownerGet = await api(owner.context, "GET", `${file}?download=1`);
      expect(ownerGet.status, "owner").toBe(200);
      expect(ownerGet.text).toBe(PDF);
      expect((await api(teacherCtx, "GET", file)).status, "course teacher").toBe(200);
      expect((await api(admin.context, "GET", file)).status, "admin").toBe(200);
      expect((await api(outsider.context, "GET", file)).status, "another student").toBe(404);
      expect((await api(teacher2.context, "GET", file)).status, "another teacher").toBe(404);
      expect((await api(anon, "GET", file)).status, "anonymous").toBe(401);
      const foreignRevoke = await api(teacher2.context, "POST", `/api/teacher/certificates/${certId}/revoke`, {
        reason: "Begona o'qituvchi",
      });
      expect(foreignRevoke.status, "another teacher cannot revoke").toBe(404);

      monitor.noteAction("Teacher revokes the certificate");
      const reason = "E2E noto‘g‘ri berilgan";
      await row.getByTestId("certificate-revoke").click();
      const revokeDialog = teacherPage.locator("dialog[open]");
      await revokeDialog.getByLabel("Sabab").fill(reason);
      await revokeDialog.getByTestId("certificate-revoke-confirm").click();
      await expect(row).toContainText("Qayta berish");

      monitor.noteAction("Student loses the certificate");
      await owner.page.goto("/certificates");
      await expect(owner.page.getByTestId("certificate-card").filter({ hasText: F.certificate.courseTitle })).toHaveCount(0);
      expect((await api(owner.context, "GET", file)).status, "owner after revoke").toBe(404);
      expect((await open(owner.context, `/certificates/${certId}`)).finalUrl).toMatch(/\/certificates$/);

      monitor.noteAction("Admin and teacher see the revocation with its reason");
      await admin.page.goto("/admin/certificates");
      const table = admin.page.getByTestId("admin-certificates");
      await expect(table).toContainText("Bekor qilingan");
      await expect(table).toContainText(reason);
      await teacherPage.goto(`/certificates/${certId}`);
      await expect(teacherPage.getByTestId("certificate-revoked")).toContainText(reason);

      for (const a of [owner, outsider, teacher2, admin]) await a.done();
    } finally {
      for (const c of [owner.context, outsider.context, teacher2.context, admin.context, anon]) {
        await c.close().catch(() => undefined);
      }
    }
  });
});
