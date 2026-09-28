import { NextResponse } from "next/server";
import {
  e2eFixtureResetGate,
  resetTokenMatches,
  resolveOwnedLessonIds,
  runE2EFixtureReset,
} from "@/lib/e2e-fixture-reset";
import { isProductionLikeEnv } from "@/lib/recording-legacy-migration";

export const dynamic = "force-dynamic";

/**
 * Staging/local only: reset E2E-owned fixture lessons so browser suites are rerunnable.
 * 404 unless E2E_FIXTURE_RESET_TOKEN is configured, the process is not production-like,
 * and the caller sends the same token in `x-e2e-reset-token`.
 * Body: { lessonIds?: string[] } — restricted to E2E-owned lesson ids.
 */
export async function POST(req: Request) {
  const gate = e2eFixtureResetGate({
    token: process.env.E2E_FIXTURE_RESET_TOKEN,
    productionLike: isProductionLikeEnv(),
  });
  if (!gate.allowed || !resetTokenMatches(req.headers.get("x-e2e-reset-token"), gate.token)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { lessonIds?: unknown };
  const lessonIds = resolveOwnedLessonIds(body.lessonIds);
  if (!lessonIds.length) {
    return NextResponse.json({ error: "No E2E-owned lesson ids" }, { status: 400 });
  }
  const report = await runE2EFixtureReset({ lessonIds });
  return NextResponse.json({ ok: true, ...report });
}
