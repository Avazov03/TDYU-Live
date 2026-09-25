/**
 * Phase 8 Recording Wave 3 — legacy VOD migration CLI.
 *
 * Default: DRY-RUN (inspect + classify + report; no Mux/DB mutation).
 *
 * Apply (staging):
 *   FF_RECORDING_LEGACY_MIGRATION_V1=true
 *   CONFIRM_RECORDING_MIGRATION=true
 *   npx tsx scripts/recording-legacy-migrate.ts --apply
 *
 * Production apply (extra gate — do not use casually):
 *   CONFIRM_PRODUCTION_RECORDING_MIGRATION=true
 *   + both flags above
 *
 * Optional:
 *   --disable-old-public  delete old public playback ID after mapping (real Mux only)
 *   --recording-id <uuid> limit to one recording
 */

import "dotenv/config";
import {
  assertMigrationApplyAllowed,
  isProductionLikeEnv,
  runRecordingLegacyMigration,
} from "../src/lib/recording-legacy-migration";
import { isRecordingLegacyMigrationV1Enabled } from "../src/lib/feature-flags";

const APPLY = process.argv.includes("--apply");
const DISABLE_OLD = process.argv.includes("--disable-old-public");
const idIdx = process.argv.indexOf("--recording-id");
const recordingId =
  idIdx >= 0 && process.argv[idIdx + 1] ? process.argv[idIdx + 1].trim() : null;

async function main() {
  const isProd = isProductionLikeEnv();
  assertMigrationApplyAllowed({
    apply: APPLY,
    isProduction: isProd,
    confirmRecordingMigration: process.env.CONFIRM_RECORDING_MIGRATION === "true",
    confirmProductionRecordingMigration:
      process.env.CONFIRM_PRODUCTION_RECORDING_MIGRATION === "true",
    flagEnabled: isRecordingLegacyMigrationV1Enabled(),
  });

  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log(`Production-like: ${isProd}`);
  console.log(`Disable old public: ${DISABLE_OLD && APPLY}`);
  if (recordingId) console.log(`Recording filter: ${recordingId}`);

  const summary = await runRecordingLegacyMigration({
    dryRun: !APPLY,
    disableOldPublic: APPLY && DISABLE_OLD,
    recordingIds: recordingId ? [recordingId] : undefined,
    actorId: null,
  });

  console.log(
    JSON.stringify(
      {
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
        muxVerification: summary.muxVerification,
        dryRun: summary.dryRun,
      },
      null,
      2,
    ),
  );

  for (const item of summary.items) {
    console.log(
      `[${item.action}] ${item.recordingId} class=${item.vodClass} status=${item.status} playback=${item.muxPlaybackId ?? "-"} :: ${item.reason}`,
    );
  }

  if (summary.FAILED > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  });
