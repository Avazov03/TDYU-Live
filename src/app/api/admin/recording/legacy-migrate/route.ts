import { NextResponse } from "next/server";
import { auth, isAdminRole } from "@/lib/auth";
import { isRecordingLegacyMigrationV1Enabled } from "@/lib/feature-flags";
import {
  assertMigrationApplyAllowed,
  isProductionLikeEnv,
  runRecordingLegacyMigration,
} from "@/lib/recording-legacy-migration";

/**
 * Admin-only legacy VOD migration endpoint (Wave 3).
 * Default dryRun=true. Apply requires CONFIRM_RECORDING_MIGRATION (+ prod gate).
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 });
  }

  if (!isRecordingLegacyMigrationV1Enabled()) {
    return NextResponse.json({ code: "FEATURE_DISABLED" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    dryRun?: boolean;
    disableOldPublic?: boolean;
    recordingId?: string;
    confirm?: boolean;
  };

  const dryRun = body.dryRun !== false; // default true
  const apply = !dryRun;

  try {
    assertMigrationApplyAllowed({
      apply,
      isProduction: isProductionLikeEnv(),
      confirmRecordingMigration:
        body.confirm === true || process.env.CONFIRM_RECORDING_MIGRATION === "true",
      confirmProductionRecordingMigration:
        process.env.CONFIRM_PRODUCTION_RECORDING_MIGRATION === "true",
      flagEnabled: true,
    });
  } catch (err) {
    return NextResponse.json(
      { code: "CONFIRM_REQUIRED", error: err instanceof Error ? err.message : "blocked" },
      { status: 400 },
    );
  }

  const summary = await runRecordingLegacyMigration({
    dryRun,
    disableOldPublic: Boolean(body.disableOldPublic) && apply,
    recordingIds: body.recordingId ? [body.recordingId] : undefined,
    actorId: session.user.id,
  });

  return NextResponse.json({
    ok: true,
    dryRun: summary.dryRun,
    muxVerification: summary.muxVerification,
    TOTAL: summary.TOTAL,
    PUBLIC: summary.PUBLIC,
    SIGNED: summary.SIGNED,
    LOCAL: summary.LOCAL,
    MISSING: summary.MISSING,
    UNKNOWN: summary.UNKNOWN,
    WOULD_MIGRATE: summary.WOULD_MIGRATE,
    WOULD_SKIP: summary.WOULD_SKIP,
    WOULD_BLOCK: summary.WOULD_BLOCK,
    MIGRATED: summary.MIGRATED,
    SKIPPED: summary.SKIPPED,
    BLOCKED: summary.BLOCKED,
    FAILED: summary.FAILED,
    items: summary.items.map((i) => ({
      recordingId: i.recordingId,
      lessonId: i.lessonId,
      courseId: i.courseId,
      status: i.status,
      vodClass: i.vodClass,
      action: i.action,
      reason: i.reason,
      muxPlaybackId: i.muxPlaybackId,
      muxVerification: i.muxVerification,
      priorMigration: i.priorMigration,
    })),
  });
}
