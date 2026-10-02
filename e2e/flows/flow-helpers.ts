import type { Browser, BrowserContext, Page } from "@playwright/test";
import { test } from "../fixtures";
import { loginAs } from "../auth/login";
import { BrowserMonitor } from "../helpers/browser-monitor";
import { FLOW_FIXTURES } from "../helpers/test-data";

export function skipUnlessFlows() {
  const v = process.env.E2E_FLOWS?.trim().toLowerCase();
  test.skip(
    !(v === "1" || v === "true" || v === "yes"),
    "Skipped: mutating flows need the hermetic seed (npm run test:e2e:full sets E2E_FLOWS=1)",
  );
}

export type Actor = {
  context: BrowserContext;
  page: Page;
  monitor: BrowserMonitor;
  /** Fails the test on critical browser errors seen on this actor's page, then closes it. */
  done(): Promise<void>;
};

/** Logs a flow user into a fresh, monitored browser context. */
export async function actor(browser: Browser, email: string, expectPath?: RegExp): Promise<Actor> {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const page = await context.newPage();
  const monitor = new BrowserMonitor(page);
  monitor.attach();
  await loginAs(page, { email, password: FLOW_FIXTURES.password }, { monitor, expectPath });
  return {
    context,
    page,
    monitor,
    async done() {
      try {
        monitor.assertNoCriticalBrowserErrors();
      } finally {
        await context.close();
      }
    },
  };
}

export async function anonymous(browser: Browser) {
  return browser.newContext({ baseURL: test.info().project.use.baseURL });
}

/**
 * API call from a throwaway tab of `context` (carries its session cookie). Expected 4xx answers
 * stay out of the monitored pages' console.
 */
export async function api(
  context: BrowserContext,
  method: "GET" | "POST",
  url: string,
  body?: Record<string, unknown> | { multipart: Record<string, string | { name: string; type: string; text: string }> },
) {
  const probe = await context.newPage();
  try {
    await probe.goto("/robots.txt").catch(() => undefined);
    return await probe.evaluate(
      async ({ method, url, body }) => {
        let init: RequestInit = { method };
        if (body && "multipart" in body) {
          const form = new FormData();
          for (const [k, v] of Object.entries(body.multipart as Record<string, unknown>)) {
            if (typeof v === "string") form.append(k, v);
            else {
              const f = v as { name: string; type: string; text: string };
              form.append(k, new File([f.text], f.name, { type: f.type }));
            }
          }
          init = { method, body: form };
        } else if (body) {
          init = { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } };
        }
        const res = await fetch(url, init);
        const text = await res.text();
        let json: unknown = null;
        try {
          json = JSON.parse(text);
        } catch {
          json = null;
        }
        return { status: res.status, json: json as Record<string, unknown> | null, text };
      },
      { method, url, body },
    );
  } finally {
    await probe.close();
  }
}

/** Navigation status + body of a URL in a throwaway tab of `context`. */
export async function open(context: BrowserContext, url: string) {
  const probe = await context.newPage();
  try {
    const res = await probe.goto(url);
    const body = res ? await res.body().catch(() => Buffer.alloc(0)) : Buffer.alloc(0);
    return { status: res?.status() ?? 0, headers: res?.headers() ?? {}, body, finalUrl: probe.url() };
  } finally {
    await probe.close();
  }
}
