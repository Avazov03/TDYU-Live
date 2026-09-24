import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import type { RoleCreds } from "../helpers/env";
import type { BrowserMonitor } from "../helpers/browser-monitor";

/**
 * UI login via credentials form. Does not hardcode accounts —
 * callers pass env-based RoleCreds.
 */
export async function loginAs(
  page: Page,
  creds: RoleCreds,
  options?: { monitor?: BrowserMonitor; expectPath?: RegExp | string },
): Promise<void> {
  options?.monitor?.noteAction(`Open /login as ${creds.email}`);
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /Xush kelibsiz/i })).toBeVisible();

  options?.monitor?.noteAction(`Fill email ${creds.email}`);
  await page.locator("#login-email").fill(creds.email);
  options?.monitor?.noteAction("Fill password");
  // Prefer #login-password: getByLabel('Parol') also matches "Parolni ko'rsatish".
  await page.locator("#login-password").fill(creds.password);

  options?.monitor?.noteAction('Click "Kirish"');
  await page.getByRole("button", { name: "Kirish", exact: true }).click();

  try {
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
      timeout: 20_000,
    });
  } catch {
    // Prefer the login form alert — ignore empty Next.js Dev Tools role=alert nodes.
    const formAlert = page.locator("form [role='alert']");
    const text = (await formAlert.textContent().catch(() => null))?.trim();
    throw new Error(
      text
        ? `Login failed on /login: ${text}`
        : "Login failed: still on /login after submit (check credentials or DB schema drift).",
    );
  }

  if (options?.expectPath) {
    await expect(page).toHaveURL(options.expectPath);
  }
}
