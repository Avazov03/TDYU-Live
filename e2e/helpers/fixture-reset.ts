import { request } from "@playwright/test";
import { resolveBaseURL } from "./env";

/**
 * Stateful suites (live, recording) reset their E2E-owned lesson through
 * POST /api/e2e/fixture-reset (staging/local only; token must match the server's
 * E2E_FIXTURE_RESET_TOKEN). Without it a failed run would leave the lesson live
 * and poison the next run, so those suites refuse to start unconfigured.
 */
export function fixtureResetToken(): string | null {
  return process.env.E2E_FIXTURE_RESET_TOKEN?.trim() || null;
}

export async function resetE2EFixtures(lessonIds: string[]): Promise<void> {
  const token = fixtureResetToken();
  if (!token) {
    throw new Error(
      "E2E_FIXTURE_RESET_TOKEN is not set. Live/recording suites mutate shared fixture lessons " +
        "and must reset them before and after each run (see docs/qa/BROWSER-E2E.md).",
    );
  }
  const ctx = await request.newContext({ baseURL: resolveBaseURL() });
  try {
    const res = await ctx.post("/api/e2e/fixture-reset", {
      headers: { "x-e2e-reset-token": token },
      data: { lessonIds },
    });
    if (!res.ok()) {
      throw new Error(`Fixture reset failed: HTTP ${res.status()} ${await res.text()}`);
    }
    const body = (await res.json()) as { resetLessons?: number; upcomingBlockers?: string[] };
    if (body.resetLessons !== lessonIds.length) {
      throw new Error(`Fixture reset touched ${body.resetLessons} of ${lessonIds.length} lessons`);
    }
    if (body.upcomingBlockers?.length) {
      throw new Error(
        `Fixture teacher has lessons starting within 90 minutes (early-start conflict): ${body.upcomingBlockers.join(", ")}`,
      );
    }
  } finally {
    await ctx.dispose();
  }
}

/** afterAll teardown: best effort, no-op when the suite never ran (token unset). */
export async function teardownE2EFixtures(lessonIds: string[]): Promise<void> {
  if (!fixtureResetToken()) return;
  await resetE2EFixtures(lessonIds);
}
