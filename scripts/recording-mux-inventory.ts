/**
 * Phase 8 — READ-ONLY Mux / Recording inventory CLI.
 *
 * This script always forces inventory/audit mode (cannot apply migrations).
 *
 * Usage:
 *   npm run db:recording:mux:inventory
 *
 * Never mutates Mux or DB. Never prints secrets.
 */

import "dotenv/config";
import {
  runRecordingMuxInventory,
  safeEnvFingerprint,
} from "../src/lib/recording-mux-inventory";
import { getMuxReadOnlyCounters } from "../src/lib/mux-read-only";

async function main() {
  // Hard-bind this CLI to read-only inventory — never migration apply.
  process.env.AUDIT_ONLY = "true";
  process.env.RECORDING_MIGRATION_MODE = "inventory";

  const env = safeEnvFingerprint();
  console.log("=== RECORDING MUX INVENTORY (READ-ONLY) ===");
  console.log(JSON.stringify(env, null, 2));

  const summary = await runRecordingMuxInventory({
    queryMux: true,
    includeOrphanLessons: true,
  });

  const out = {
    ENVIRONMENT: summary.environment,
    MODE: summary.mode,
    MUX_API: summary.muxApi,
    REAL_MUX_VERIFICATION: summary.realMuxVerification,
    RECORDINGS: {
      TOTAL: summary.TOTAL_RECORDINGS,
      ORPHAN_LESSONS: summary.TOTAL_ORPHAN_LESSONS,
      PUBLIC_VOD: summary.PUBLIC_VOD,
      SIGNED_VOD: summary.SIGNED_VOD,
      LOCAL_ONLY: summary.LOCAL_ONLY,
      MISSING_ASSET: summary.MISSING_ASSET,
      UNKNOWN: summary.UNKNOWN,
      ORPHAN_MUX_REFERENCE: summary.ORPHAN_MUX_REFERENCE,
      LEGACY_PUBLIC_VOD_PUBLISHED: summary.LEGACY_PUBLIC_VOD_PUBLISHED,
      ALREADY_SECURE_SIGNED: summary.ALREADY_SECURE_SIGNED,
      PUBLIC_URL_REFERENCE: summary.PUBLIC_URL_REFERENCE,
    },
    MIGRATION: {
      SAFE_CANDIDATE: summary.SAFE_CANDIDATE,
      ALREADY_SIGNED: summary.ALREADY_SIGNED,
      LOCAL_ONLY: summary.LOCAL_BUCKET,
      ORPHAN: summary.ORPHAN,
      MISSING: summary.MISSING,
      UNKNOWN: summary.UNKNOWN_BUCKET,
      BLOCKED: summary.BLOCKED,
    },
    MUTATIONS: {
      ...summary.muxCounters,
      DB_WRITE: summary.dbWrite,
    },
  };

  console.log(JSON.stringify(out, null, 2));

  for (const item of summary.items) {
    console.log(
      `[${item.migrationBucket}] vod=${item.vodClass} rec=${item.recordingId ?? "-"} lesson=${item.lessonId} course=${item.courseId} status=${item.recordingStatus ?? "-"} playback=${item.muxPlaybackId ?? "-"} asset=${item.muxAssetId ?? "-"} policy=${item.muxPolicy ?? "-"} :: ${item.reason}`,
    );
  }

  const c = getMuxReadOnlyCounters();
  if (c.MUX_POST + c.MUX_PATCH + c.MUX_PUT + c.MUX_DELETE > 0) {
    console.error("FATAL: non-GET Mux counter > 0");
    process.exitCode = 2;
  }
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
