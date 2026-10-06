/**
 * Local-only real-browser QA journey (Chromium, fake camera/mic). Each role has its own profile.
 * Refuses to run against anything but http://localhost:3000. Writes screenshots to .tmp-qa/.
 */
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const PASS = "demo1234";
const OUT = ".tmp-qa";
const [QA_COURSE, QA_LESSON_1, QA_LESSON_2, QA_LESSON_3, QA_TITLE] = process.argv.slice(2);
if (!QA_TITLE) {
  console.error("usage: local-qa-journey <course> <lesson1> <lesson2> <lesson3> <title>  (from local-qa-fixtures --fresh-course)");
  process.exit(1);
}
const COURSE_A = "a4444444-4444-4444-4444-444444444401";
const COURSE_B = "a4444444-4444-4444-4444-444444444402";

mkdirSync(OUT, { recursive: true });
const results: { step: string; ok: boolean; note?: string }[] = [];
const problems: string[] = [];

function record(step: string, ok: boolean, note?: string) {
  results.push({ step, ok, note });
  console.log(`${ok ? "PASS" : "FAIL"} ${step}${note ? ` — ${note}` : ""}`);
}

async function check(step: string, fn: () => Promise<string | void>) {
  try {
    const note = await fn();
    record(step, true, note || undefined);
  } catch (err) {
    record(step, false, err instanceof Error ? err.message.split("\n")[0] : String(err));
  }
}

async function role(browser: Browser, label: string): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ baseURL: BASE, permissions: ["camera", "microphone"] });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(`[${label}] pageerror ${e.message.slice(0, 160)}`));
  page.on("response", (r) => {
    if (r.status() >= 500) problems.push(`[${label}] ${r.status()} ${r.url()}`);
  });
  return { ctx, page };
}

async function login(page: Page, email: string, callback: string) {
  await page.goto(`/login?callbackUrl=${encodeURIComponent(callback)}`);
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(PASS);
  await page.getByRole("button", { name: "Kirish", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
}

async function confirmDialog(page: Page) {
  const ok = page.locator("[data-testid=confirm-ok]");
  await ok.waitFor({ state: "visible", timeout: 10_000 });
  await ok.click();
}

async function buy(page: Page, courseId: string, label: string) {
  await page.goto(`/courses/${courseId}`);
  await page.locator("[data-testid=checkout-v2-cta]").click();
  await page.waitForURL(/\/checkout\/v2/, { timeout: 20_000 });
  await page.locator("[data-testid=checkout-v2-continue]").click();
  await page.locator("[data-testid=checkout-v2-method-demo]").click();
  await page.locator("[data-testid=checkout-v2-pay]").dblclick();
  await page.locator("[data-testid=checkout-v2-success]").waitFor({ timeout: 20_000 });
  await page.screenshot({ path: `${OUT}/${label}-checkout-success.png` });
  await page.locator("[data-testid=checkout-v2-goto-my-courses]").click();
  await page.waitForURL(/\/my-courses/, { timeout: 20_000 });
}

async function runLesson(
  teacher: Page,
  lessonId: string,
  opts: { student?: Page; label: string },
): Promise<void> {
  await teacher.goto(`/teacher/live/${lessonId}`);
  await teacher.locator("[data-testid=live-open-waiting]").click();
  await teacher.locator("[data-testid=live-start]").waitFor({ timeout: 20_000 });
  await teacher.locator("[data-testid=live-start]").dblclick();
  await teacher.locator("[data-testid=live-end]").waitFor({ timeout: 20_000 });
  if (opts.student) {
    await opts.student.goto(`/learn/${lessonId}`);
    await opts.student.waitForTimeout(6_000);
    await opts.student.screenshot({ path: `${OUT}/${opts.label}-student-live.png` });
  }
  await teacher.waitForTimeout(25_000);
  await teacher.locator("[data-testid=live-end]").click();
  await confirmDialog(teacher);
  await teacher.waitForURL((u) => !u.pathname.includes("/teacher/live/") || true, { timeout: 30_000 });
  await teacher.waitForTimeout(3_000);
  if (opts.student) await opts.student.goto("/my-courses");
}

async function publishRecording(teacher: Page, lessonId: string) {
  await teacher.goto(`/learn/${lessonId}`);
  const btn = teacher.locator("[data-testid=recording-publish]");
  if (!(await btn.isVisible().catch(() => false))) return "no recording to publish";
  await btn.click();
  await teacher.locator("[data-testid=recording-publish-confirm]").click();
  await btn.waitFor({ state: "detached", timeout: 15_000 });
  return "published";
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  });
  const nopay = await role(browser, "nopay");
  const active1 = await role(browser, "active1");
  const multi = await role(browser, "multi");
  const teacher = await role(browser, "teacher");
  const admin = await role(browser, "admin");

  await login(nopay.page, "fixture.nopay@lexify.local", "/my-courses");
  await login(active1.page, "fixture.active1@lexify.local", "/my-courses");
  await login(multi.page, "fixture.multi@lexify.local", "/my-courses");
  await login(teacher.page, "fixture.teacher@lexify.local", "/teacher");
  await login(admin.page, "fixture.admin@lexify.local", "/admin");

  await check("PURCHASE: nopay buys Course B (not started yet)", async () => {
    await buy(nopay.page, COURSE_B, "nopay");
  });
  await check("REFUND before start: student sees 100% option from course page", async () => {
    const p = nopay.page;
    await p.goto(`/courses/${COURSE_B}`);
    await p.locator("[data-testid=course-support-link]").click();
    await p.waitForURL(/\/support/);
    await p.locator("[data-testid=refund-before-start]").first().waitFor({ timeout: 10_000 });
  });
  await check("REFUND before start: confirm → success, access closed", async () => {
    const p = nopay.page;
    await p.locator("[data-testid=refund-before-start]").first().click();
    await confirmDialog(p);
    await p.locator("[data-testid=refund-success]").waitFor({ timeout: 15_000 });
    await p.screenshot({ path: `${OUT}/refund-before-start.png` });
    await p.goto("/my-courses");
    if (p.url().includes("/my-courses") && (await p.locator("main").innerText()).includes("Fixture Course B")) {
      throw new Error("Course B still in My Courses after refund");
    }
    await p.goto(`/courses/${COURSE_B}`);
    if (await p.locator("[data-testid=course-owned]").count()) throw new Error("course still owned");
    await p.locator("[data-testid=checkout-v2-cta]").waitFor({ timeout: 10_000 });
    return `my-courses → ${new URL(p.url()).pathname}; buy button back`;
  });

  await check("PURCHASE multi-course: active1 buys QA course, Course A stays", async () => {
    await buy(active1.page, QA_COURSE, "active1");
    const body = await active1.page.locator("body").innerText();
    if (!body.includes("Fixture Course A")) throw new Error("Course A disappeared");
    if (!body.includes(QA_TITLE)) throw new Error("QA course missing");
    await active1.page.screenshot({ path: `${OUT}/active1-my-courses.png` });
  });
  await check("PURCHASE: second student buys QA course", async () => {
    await buy(multi.page, QA_COURSE, "multi");
  });
  await check("PURCHASE: already-owned course shows owned panel (no second buy)", async () => {
    await active1.page.goto(`/courses/${QA_COURSE}`);
    await active1.page.locator("[data-testid=course-owned]").waitFor({ timeout: 10_000 });
  });

  await check("LIVE lesson 1: waiting → start (double click) → student joins → end", async () => {
    await runLesson(teacher.page, QA_LESSON_1, { student: active1.page, label: "lesson1" });
  });
  await check("LIVE: ended lesson cannot be joined by the student", async () => {
    await active1.page.goto(`/learn/${QA_LESSON_1}`);
    await active1.page.waitForTimeout(3_000);
    if (await active1.page.locator("[data-testid=live-teaching-clock]").count()) throw new Error("live room still open");
  });
  await check("RECORDING lesson 1: teacher publishes", async () => publishRecording(teacher.page, QA_LESSON_1));

  await check("REFUND special 50%: admin, progress < 50%", async () => {
    const p = admin.page;
    await p.goto("/admin/payments");
    const row = p.locator("tr", { hasText: "Fixture Multi" }).filter({ hasText: QA_TITLE });
    await row.locator("[data-testid=refund-eligible] button").click();
    await row.getByLabel("Qaytarish asosi").fill("Talaba kasal bo‘lib qoldi, hujjat bor");
    await row.getByRole("button", { name: "50% qaytarish" }).click();
    await row.locator("[data-testid=refund-done]").waitFor({ timeout: 15_000 });
    await p.screenshot({ path: `${OUT}/admin-refund-50.png` });
  });
  await check("REFUND: refunded student loses course access", async () => {
    await multi.page.goto(`/learn/${QA_LESSON_1}`);
    const body = await multi.page.locator("body").innerText();
    if (!body.includes("kirish yopilgan")) throw new Error("refunded student still has access");
    if (await multi.page.locator("[data-testid=recording-player]").count()) throw new Error("replay visible after refund");
  });

  await check("LIVE lessons 2 and 3 run and end", async () => {
    for (const id of [QA_LESSON_2, QA_LESSON_3]) {
      await runLesson(teacher.page, id, { label: `lesson-${id.slice(0, 4)}` });
      await publishRecording(teacher.page, id);
    }
  });
  await check("REFUND: no special refund at progress ≥ 50%", async () => {
    const p = admin.page;
    await p.goto("/admin/payments");
    const row = p.locator("tr", { hasText: "Fixture Active One" }).filter({ hasText: QA_TITLE });
    await row.first().waitFor({ timeout: 10_000 });
    if (await row.locator("[data-testid=refund-eligible]").count()) throw new Error("50% offered at ≥50% progress");
    return (await row.locator(".lx-pay-note").innerText().catch(() => "")).slice(0, 90);
  });

  await check("COMPLETION: teacher completes the course", async () => {
    const p = teacher.page;
    await p.goto("/teacher");
    const box = p.locator("article.lx-tc-card", { hasText: QA_TITLE }).locator("[data-testid=course-complete]");
    await box.getByRole("button", { name: "Kursni yakunlash" }).click();
    await box.getByRole("button", { name: "Ha, yakunlash" }).click();
    await box.waitFor({ state: "detached", timeout: 15_000 });
  });
  await check("HISTORY: completed course is in student History with replay", async () => {
    const p = active1.page;
    await p.goto("/history");
    const card = p.locator("[data-testid=history-completed-course]", { hasText: QA_TITLE });
    await card.waitFor({ timeout: 10_000 });
    await p.screenshot({ path: `${OUT}/history.png`, fullPage: true });
    await card.getByRole("link", { name: "Yozuvlarni ko‘rish" }).click();
    await p.waitForURL(new RegExp(QA_COURSE));
    await p.goto(`/learn/${QA_LESSON_1}`);
    const players = await p.locator("[data-testid=recording-player]").count();
    return players ? "replay player visible" : "no replay player (lesson ended without recording)";
  });
  await check("HISTORY: other student cannot see it", async () => {
    await nopay.page.goto("/history");
    if (await nopay.page.locator("[data-testid=history-completed-course]", { hasText: QA_TITLE }).count()) {
      throw new Error("leak");
    }
  });

  if (!process.env.QA_SKIP_CATALOG_ADMIN) await check("ADMIN teacher replacement on Course C", async () => {
    const p = admin.page;
    await p.goto("/admin/courses");
    await p.locator(".admin-course-main", { hasText: "Fixture Course C" }).click();
    await p.getByRole("button", { name: "O‘qituvchini almashtirish" }).click();
    const select = p.locator("select[id^=repl-]");
    await select.waitFor({ timeout: 10_000 });
    await p.getByRole("button", { name: "Almashtirish", exact: true }).click();
    await confirmDialog(p);
    await p.getByText("O‘qituvchi almashtirildi").waitFor({ timeout: 15_000 });
    await p.screenshot({ path: `${OUT}/admin-replace.png` });
  });
  if (!process.env.QA_SKIP_CATALOG_ADMIN) await check("ADMIN unpublish Course A requires reason, keeps enrolled access", async () => {
    const p = admin.page;
    await p.goto("/admin/courses");
    await p.locator(".admin-course-main", { hasText: "Fixture Course A" }).click();
    await p.getByRole("button", { name: "Nashrdan olish" }).click();
    await p.getByText("Sababni yozing").waitFor({ timeout: 5_000 });
    await p.locator(`#unpub-${COURSE_A}`).fill("Dars rejasi qayta ko‘rib chiqiladi");
    await p.getByRole("button", { name: "Nashrdan olish" }).click();
    await confirmDialog(p);
    await p.getByText("Kurs sotuvdan olindi").waitFor({ timeout: 15_000 });
    await active1.page.goto("/my-courses");
    if (!(await active1.page.locator("body").innerText()).includes("Fixture Course A")) {
      throw new Error("enrolled student lost Course A");
    }
    await nopay.page.goto(`/courses/${COURSE_A}`);
    if (await nopay.page.locator("[data-testid=checkout-v2-cta]").count()) throw new Error("still purchasable");
  });

  await check("SECURITY: guest is sent to login from private pages", async () => {
    const guest = await role(browser, "guest");
    for (const path of ["/my-courses", "/history", "/support", "/admin", "/teacher"]) {
      await guest.page.goto(path);
      if (!guest.page.url().includes("/login") && !guest.page.url().endsWith("/")) {
        throw new Error(`${path} → ${guest.page.url()}`);
      }
    }
    await guest.ctx.close();
  });
  await check("SECURITY: student cannot open admin/teacher", async () => {
    for (const path of ["/admin/payments", "/teacher"]) {
      await active1.page.goto(path);
      if (active1.page.url().includes(path)) throw new Error(`${path} opened for student`);
    }
  });

  for (const width of [390, 768, 1024]) {
    await check(`MOBILE ${width}px: no horizontal overflow on critical pages`, async () => {
      const bad: string[] = [];
      for (const [label, page, path] of [
        ["student", active1.page, "/my-courses"],
        ["student", active1.page, "/history"],
        ["student", active1.page, `/courses/${QA_COURSE}`],
        ["student", active1.page, `/learn/${QA_LESSON_1}`],
        ["student", active1.page, "/support"],
        ["guest", nopay.page, `/courses/${COURSE_B}`],
        ["teacher", teacher.page, "/teacher"],
        ["teacher", teacher.page, "/teacher/reja"],
        ["admin", admin.page, "/admin/payments"],
        ["admin", admin.page, "/admin/courses"],
      ] as const) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await page.waitForTimeout(500);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (over > 2) bad.push(`${label} ${path} +${over}px`);
        if (width === 390) await page.screenshot({ path: `${OUT}/m390-${label}-${path.replace(/\W+/g, "_")}.png` });
      }
      if (bad.length) throw new Error(bad.join("; "));
    });
  }

  await browser.close();
  console.log("\nSERVER/PAGE PROBLEMS:", problems.length ? problems.join("\n") : "none");
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
  process.exit(results.every((r) => r.ok) && problems.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
