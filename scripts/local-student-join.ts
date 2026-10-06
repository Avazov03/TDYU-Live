/**
 * Local-only: log in as the enrolled fixture student and open a live lesson.
 * Separate Chromium profile — does not touch the teacher browser session.
 */
import { chromium } from "playwright";

const base = "http://localhost:3000";
const lessonId = process.argv[2];
const email = process.argv[3] || "fixture.active1@lexify.local";
if (!lessonId) {
  console.error("lesson id required");
  process.exit(1);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const joins: number[] = [];
  page.on("response", (res) => {
    if (res.url().includes("/api/live/join")) joins.push(res.status());
  });
  await page.goto(`${base}/login?callbackUrl=${encodeURIComponent(`/learn/${lessonId}`)}`);
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill("demo1234");
  await page.getByRole("button", { name: "Kirish", exact: true }).click();
  await page.waitForURL((url) => url.pathname.includes("/learn/"), { timeout: 20_000 });
  await page.waitForTimeout(4000);
  const text = (await page.locator("body").innerText()).slice(0, 400);
  const player = await page.locator("[data-testid=recording-player]").count();
  const pending = await page.getByText("tekshiruv", { exact: false }).count();
  console.log(JSON.stringify({ email, url: page.url(), joins, player, pending, snippet: text.replace(/\s+/g, " ").slice(0, 320) }));
  await browser.close();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : "failed");
  process.exit(1);
});
