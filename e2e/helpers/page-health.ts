import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Structural page checks that need no design knowledge: horizontal overflow, duplicate ids,
 * controls without an accessible name, form fields without a label, images without alt.
 */
export async function pageHealth(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const overflow = document.documentElement.scrollWidth - vw;
    // checkVisibility also covers closed <details>, content-visibility and hidden ancestors.
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && el.checkVisibility({ visibilityProperty: true, opacityProperty: true });
    };
    const describe = (el: Element) => {
      const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2) : [];
      const hint =
        el.getAttribute("placeholder") || el.getAttribute("name") || (el as HTMLInputElement).type || el.getAttribute("href") || "";
      return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${cls.length ? "." + cls.join(".") : ""}${hint ? `[${hint.slice(0, 40)}]` : ""}`;
    };

    const culprits: string[] = [];
    if (overflow > 1) {
      for (const el of document.body.querySelectorAll<HTMLElement>("*")) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > vw + 1 && getComputedStyle(el).position !== "fixed") {
          culprits.push(`${describe(el)} → ${Math.round(r.right)}px`);
          if (culprits.length >= 5) break;
        }
      }
    }

    const ids = new Map<string, number>();
    for (const el of document.querySelectorAll("[id]")) ids.set(el.id, (ids.get(el.id) ?? 0) + 1);

    const name = (el: Element) =>
      (
        el.getAttribute("aria-label") ||
        (el.getAttribute("aria-labelledby") ?? "")
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? "")
          .join(" ") ||
        el.getAttribute("title") ||
        (el as HTMLElement).innerText ||
        el.querySelector("img[alt]")?.getAttribute("alt") ||
        el.querySelector("svg title")?.textContent ||
        ""
      ).trim();
    const unnamed = [...document.querySelectorAll("button, a[href], [role=button]")]
      .filter((el) => visible(el) && !name(el))
      .map(describe);
    const unlabeled = [...document.querySelectorAll("input, select, textarea")]
      .filter((el) => {
        const input = el as HTMLInputElement;
        if (["hidden", "submit", "button", "reset"].includes(input.type) || !visible(el)) return false;
        return !(
          input.labels?.length ||
          el.getAttribute("aria-label") ||
          el.getAttribute("aria-labelledby") ||
          el.getAttribute("title")
        );
      })
      .map(describe);
    const noAlt = [...document.querySelectorAll("img")].filter((img) => visible(img) && !img.hasAttribute("alt")).map(describe);

    return {
      overflowPx: overflow > 1 ? overflow : 0,
      culprits,
      duplicateIds: [...ids].filter(([, n]) => n > 1).map(([id]) => id),
      unnamed: [...new Set(unnamed)],
      unlabeled: [...new Set(unlabeled)],
      noAlt: [...new Set(noAlt)],
    };
  });
}

/** Soft-asserts every check so one run lists all problems of a page. */
export async function expectHealthyPage(page: Page, label: string) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const p = await pageHealth(page);
  expect.soft(p.overflowPx, `${label}: horizontal overflow (${p.culprits.join("; ")})`).toBe(0);
  expect.soft(p.duplicateIds, `${label}: duplicate ids`).toEqual([]);
  expect.soft(p.unnamed, `${label}: buttons/links without an accessible name`).toEqual([]);
  expect.soft(p.unlabeled, `${label}: form fields without a label`).toEqual([]);
  expect.soft(p.noAlt, `${label}: images without alt`).toEqual([]);
}
