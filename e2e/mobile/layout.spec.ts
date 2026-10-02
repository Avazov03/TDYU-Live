import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { loginAs } from "../auth/login";
import { isE2EDbReady, skipReasonDbNotReady, studentCreds, skipReasonMissingCreds } from "../helpers/env";

/**
 * Phone viewport (mobile project): no horizontal overflow, unique ids, nav reachable via the drawer.
 */

async function layoutProblems(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const overflow = document.documentElement.scrollWidth - vw;
    const culprits: string[] = [];
    if (overflow > 1) {
      for (const el of document.body.querySelectorAll<HTMLElement>("*")) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > vw + 1 && getComputedStyle(el).position !== "fixed") {
          culprits.push(`${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).trim().split(/\s+/).join(".") : ""} → ${Math.round(r.right)}px`);
          if (culprits.length >= 5) break;
        }
      }
    }
    const ids = new Map<string, number>();
    for (const el of document.querySelectorAll("[id]")) ids.set(el.id, (ids.get(el.id) ?? 0) + 1);
    return {
      overflowPx: overflow > 1 ? overflow : 0,
      culprits,
      duplicateIds: [...ids].filter(([, n]) => n > 1).map(([id]) => id),
    };
  });
}

async function expectSoundLayout(page: Page, label: string) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const p = await layoutProblems(page);
  expect.soft(p.overflowPx, `${label}: horizontal overflow (${p.culprits.join("; ")})`).toBe(0);
  expect.soft(p.duplicateIds, `${label}: duplicate ids`).toEqual([]);
}

test.describe("Mobile layout", () => {
  for (const path of ["/", "/login", "/register"]) {
    test(`public ${path} fits the phone screen`, async ({ page, monitor }) => {
      monitor.noteAction(`Goto ${path}`);
      await page.goto(path);
      await expectSoundLayout(page, path);
    });
  }

  test("student pages fit and the drawer reaches navigation", async ({ page, monitor }) => {
    test.skip(!isE2EDbReady(), skipReasonDbNotReady());
    const creds = studentCreds();
    test.skip(!creds, skipReasonMissingCreds("student"));
    await loginAs(page, creds!, { monitor });

    for (const path of ["/app", "/my-courses", "/schedule", "/assignments", "/certificates", "/settings"]) {
      monitor.noteAction(`Goto ${path}`);
      await page.goto(path);
      await expectSoundLayout(page, path);
    }

    monitor.noteAction("Open the mobile menu and navigate");
    await page.goto("/app");
    await page.getByRole("button", { name: "Menyu" }).locator("visible=true").first().click();
    const link = page.locator('a[href="/my-courses"]').locator("visible=true").first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/my-courses/);
  });
});
