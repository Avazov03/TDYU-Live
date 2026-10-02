import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";

/**
 * AI mentor widget. Needs a server with FF_AI_MENTOR_V1=1, FF_AI_MENTOR_AUDIENCE=all and
 * AI_MENTOR_FAKE=1 (deterministic offline model); set E2E_AI_FAKE=1 when running against it.
 */
const fakeServer = process.env.E2E_AI_FAKE === "1";

async function openMentor(page: Page) {
  const fab = page.getByTestId("ai-fab");
  await expect(fab).toBeVisible();
  await fab.click();
  await expect(page.getByTestId("ai-panel")).toHaveAttribute("data-open", "");
}

async function ask(page: Page, text: string) {
  await page.getByTestId("ai-input").fill(text);
  await page.getByTestId("ai-send").click();
  await expect(page.getByTestId("ai-send")).toBeVisible({ timeout: 30_000 });
  return page.getByTestId("ai-answer").last();
}

test.describe("AI mentor", () => {
  test.beforeEach(() => {
    test.skip(!fakeServer, "Skipped: E2E_AI_FAKE=1 not set (needs AI_MENTOR_FAKE server).");
  });

  test("guest: greeting, catalog tool, markdown, hidden on login", async ({ page, monitor }) => {
    monitor.noteAction("Goto / as guest");
    await page.goto("/");
    await expect(page.getByTestId("ai-greet")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("ai-greet")).toContainText("Men AI mentorman");

    await openMentor(page);
    await expect(page.getByRole("heading", { name: /^Salom/ })).toBeVisible();
    await expect(page.getByText("Bizga nima xizmat?")).toBeVisible();
    await expect(page.getByText("AI xato qilishi mumkin")).toBeVisible();

    await page.getByRole("button", { name: "Qanday kurslar bor?" }).click();
    const answer = page.getByTestId("ai-answer").last();
    await expect(answer).toContainText("FAKE(search_courses)", { timeout: 30_000 });

    monitor.noteAction("Send with Enter key");
    await page.getByTestId("ai-input").fill("salom");
    await page.getByTestId("ai-input").press("Enter");
    const plain = page.getByTestId("ai-answer").last();
    await expect(plain.locator("strong")).toHaveText("salom", { timeout: 30_000 });
    await expect(page.getByTestId("ai-input")).toHaveValue("");

    monitor.noteAction("Guest asks for personal data — tool not offered");
    const personal = await ask(page, "kurslarim");
    await expect(personal).not.toContainText("get_my_courses");

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("ai-panel")).not.toHaveAttribute("data-open", "");

    await page.goto("/login");
    await expect(page.locator("#login-email")).toBeVisible();
    await expect(page.getByTestId("ai-fab")).toHaveCount(0);
  });

  test("student: own data tool, history restore, new chat, drag", async ({ studentPage: page, monitor }) => {
    await page.goto("/my-courses");
    await openMentor(page);
    await page.getByTestId("ai-new-chat").click();

    const answer = await ask(page, "kurslarim holati");
    await expect(answer).toContainText("FAKE(get_my_courses)");
    await expect(answer).toContainText("Fixture Course A");

    monitor.noteAction("Reload — conversation restored from server");
    await page.reload();
    await openMentor(page);
    await expect(page.getByTestId("ai-answer").last()).toContainText("FAKE(get_my_courses)");

    await page.getByTestId("ai-new-chat").click();
    await expect(page.getByTestId("ai-answer")).toHaveCount(0);
    await expect(page.getByText("Bizga nima xizmat?")).toBeVisible();
    await page.getByTestId("ai-close").click();
    await expect(page.getByTestId("ai-panel")).not.toHaveAttribute("data-open", "");

    monitor.noteAction("Drag robot to the left edge");
    const fab = page.getByTestId("ai-fab");
    const box = (await fab.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(120, 300, { steps: 12 });
    await page.mouse.up();
    await expect(page.getByTestId("ai-panel")).not.toHaveAttribute("data-open", "");
    await expect.poll(async () => (await fab.boundingBox())!.x).toBeLessThan(40);

    await page.reload();
    await expect.poll(async () => (await page.getByTestId("ai-fab").boundingBox())?.x ?? 999).toBeLessThan(40);
    await page.evaluate(() => localStorage.removeItem("lx-ai-pos"));
  });

  test("hides while a live room marker is on the page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("ai-fab")).toBeVisible();
    await page.evaluate(() => {
      const el = document.createElement("div");
      el.id = "e2e-live-marker";
      el.setAttribute("data-ai-mentor-hide", "");
      document.body.appendChild(el);
    });
    await expect(page.getByTestId("ai-fab")).toHaveCount(0);
    await page.evaluate(() => document.getElementById("e2e-live-marker")?.remove());
    await expect(page.getByTestId("ai-fab")).toBeVisible();
  });

  test("API: disabled roles and bad input are rejected", async ({ request }) => {
    const bad = await request.post("/api/ai/chat", { data: { message: "" } });
    expect(bad.status()).toBe(400);
    const del = await request.delete("/api/ai/conversation");
    expect(del.status()).toBe(401);
  });
});
