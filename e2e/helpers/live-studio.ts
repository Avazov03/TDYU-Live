import type { Page } from "@playwright/test";

const BUTTON = {
  lobby: "live-open-waiting",
  start: "live-start",
  end: "live-end",
} as const;

/** Ending a lesson asks for confirmation; accept it only if the expected prompt appears. */
export function acceptNextConfirm(page: Page, message: RegExp): void {
  page.once("dialog", (dialog) => {
    if (dialog.type() === "confirm" && message.test(dialog.message())) void dialog.accept();
    else void dialog.dismiss();
  });
}

/**
 * Click a LiveStudio control and wait for its POST /api/teacher/lessons/:id/:action
 * to finish (end first uploads the recording, so it can take a while).
 */
export async function studioAction(
  page: Page,
  lessonId: string,
  action: keyof typeof BUTTON,
): Promise<void> {
  const path = `/api/teacher/lessons/${lessonId}/${action}`;
  if (action === "end") acceptNextConfirm(page, /Efirni tugatasizmi/);
  const [res] = await Promise.all([
    page.waitForResponse(
      (r) => r.request().method() === "POST" && new URL(r.url()).pathname === path,
      { timeout: 60_000 },
    ),
    page.getByTestId(BUTTON[action]).click(),
  ]);
  if (!res.ok()) {
    throw new Error(`${action} → HTTP ${res.status()} ${await res.text().catch(() => "")}`);
  }
  // Ending a live lesson sends the studio to /teacher; finish that navigation before the next step.
  if (action === "end") {
    await page.waitForURL((u) => u.pathname === "/teacher", { timeout: 30_000 });
  }
}
