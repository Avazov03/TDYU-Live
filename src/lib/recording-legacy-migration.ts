/**
 * Phase 8 Recording Wave 3 — legacy public VOD classification + safe migration.
 *
 * Additive / idempotent. Does not delete Mux assets. Prefer AuditLog for state
 * (no schema migration). Real Mux calls go through src/lib/mux.ts REST helpers.
 *
 * Fixture seam (no Mux credentials): playback IDs matching legacy_public_* /
 * public_fixture_* classify as PUBLIC_VOD and migrate to legacy_signed_* /
 * signed_fixture_* without calling Mux. Authz is unchanged (Wave 2).
 */

import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log";
import {
  createMuxSignedPlaybackId,
  deleteMuxPlaybackId,
  getMuxPlaybackIdInfo,
  isMuxConfigured,
  listMuxAssetPlaybackIds,
  type MuxPlaybackPolicy,
} from "@/lib/mux";
import { isRecordingLegacyMigrationV1Enabled } from "@/lib/feature-flags";

export const RECORDING_MIGRATE_AUDIT_ACTION = "recording.legacy_migrate_v1";

export type VodClass = "PUBLIC_VOD" | "SIGNED_VOD" | "LOCAL_ONLY" | "MISSING_ASSET" | "UNKNOWN";

export type AppRecordingState =
  | "PUBLISHED"
  | "NOT_PUBLISHED"
  | "PROCESSING"
  | "READY"
  | "FAILED"
  | "OTHER";

export type MigrationAction =
  | "WOULD_MIGRATE"
  | "WOULD_SKIP"
  | "WOULD_BLOCK"
  | "MIGRATED"
  | "SKIPPED"
  | "BLOCKED"
  | "FAILED";

export type MuxVerificationMode = "REAL" | "FIXTURE" | "UNAVAILABLE";

export type RecordingInventoryItem = {
  recordingId: string;
  lessonId: string;
  courseId: string;
  status: string;
  muxPlaybackId: string | null;
  storageKey: string | null;
  lessonRecordingUrl: string | null;
  lessonMuxVodPlaybackId: string | null;
  appState: AppRecordingState;
  vodClass: VodClass;
  muxPolicy: MuxPlaybackPolicy | "fixture_public" | "fixture_signed" | null;
  muxAssetId: string | null;
  muxVerification: MuxVerificationMode;
  existingSignedPlaybackId: string | null;
  priorMigration: {
    oldPlaybackId: string;
    newPlaybackId: string;
    completedAt: string;
  } | null;
  action: MigrationAction;
  reason: string;
};

export type MigrationSummary = {
  TOTAL: number;
  PUBLIC: number;
  SIGNED: number;
  LOCAL: number;
  MISSING: number;
  UNKNOWN: number;
  WOULD_MIGRATE: number;
  WOULD_SKIP: number;
  WOULD_BLOCK: number;
  MIGRATED: number;
  SKIPPED: number;
  BLOCKED: number;
  FAILED: number;
  muxVerification: MuxVerificationMode;
  dryRun: boolean;
  items: RecordingInventoryItem[];
};

/** Injectable Mux port for unit tests. */
export type MuxMigrationPort = {
  configured: () => boolean;
  getPlaybackInfo: (
    playbackId: string,
  ) => Promise<{
    policy: MuxPlaybackPolicy;
    objectType: "asset" | "live_stream";
    objectId: string;
  } | null>;
  listAssetPlaybackIds: (
    assetId: string,
  ) => Promise<{ id: string; policy: MuxPlaybackPolicy }[]>;
  createSignedPlaybackId: (assetId: string) => Promise<string>;
  deletePlaybackId: (assetId: string, playbackId: string) => Promise<void>;
};

export function defaultMuxMigrationPort(): MuxMigrationPort {
  return {
    configured: () => isMuxConfigured(),
    getPlaybackInfo: async (playbackId) => {
      const info = await getMuxPlaybackIdInfo(playbackId);
      if (!info) return null;
      return {
        policy: info.policy,
        objectType: info.objectType,
        objectId: info.objectId,
      };
    },
    listAssetPlaybackIds: (assetId) => listMuxAssetPlaybackIds(assetId),
    createSignedPlaybackId: (assetId) => createMuxSignedPlaybackId(assetId),
    deletePlaybackId: (assetId, playbackId) => deleteMuxPlaybackId(assetId, playbackId),
  };
}

export function mapAppRecordingState(status: string): AppRecordingState {
  switch (status) {
    case "published":
      return "PUBLISHED";
    case "processing":
      return "PROCESSING";
    case "ready":
    case "teacher_review":
      return "READY";
    case "failed":
      return "FAILED";
    case "not_started":
      return "NOT_PUBLISHED";
    default:
      return "OTHER";
  }
}

export function isFixturePublicPlaybackId(playbackId: string): boolean {
  return (
    playbackId.startsWith("legacy_public_") ||
    playbackId.startsWith("public_fixture_") ||
    playbackId === "fixture_vod"
  );
}

export function isFixtureSignedPlaybackId(playbackId: string): boolean {
  return (
    playbackId.startsWith("legacy_signed_") ||
    playbackId.startsWith("signed_fixture_")
  );
}

export function fixtureSignedPlaybackIdFromPublic(publicId: string): string {
  if (publicId.startsWith("legacy_public_")) {
    return publicId.replace(/^legacy_public_/, "legacy_signed_");
  }
  if (publicId.startsWith("public_fixture_")) {
    return publicId.replace(/^public_fixture_/, "signed_fixture_");
  }
  if (publicId === "fixture_vod") return "signed_fixture_vod";
  return `legacy_signed_${publicId}`;
}

/**
 * Pure classification helpers (unit-tested). Mux policy may be unknown.
 */
export function classifyVodFromFacts(input: {
  muxPlaybackId: string | null;
  storageKey: string | null;
  muxPolicy: MuxPlaybackPolicy | "fixture_public" | "fixture_signed" | null;
  muxLookupAttempted: boolean;
  muxFound: boolean | null;
}): { vodClass: VodClass; reason: string } {
  const { muxPlaybackId, storageKey, muxPolicy, muxLookupAttempted, muxFound } = input;

  if (!muxPlaybackId) {
    if (storageKey) return { vodClass: "LOCAL_ONLY", reason: "storageKey without muxPlaybackId" };
    return { vodClass: "MISSING_ASSET", reason: "no muxPlaybackId and no storageKey" };
  }

  if (muxPlaybackId.startsWith("demo_")) {
    return { vodClass: "LOCAL_ONLY", reason: "demo playback id" };
  }

  if (isFixtureSignedPlaybackId(muxPlaybackId) || muxPolicy === "fixture_signed") {
    return { vodClass: "SIGNED_VOD", reason: "fixture signed playback id" };
  }

  if (isFixturePublicPlaybackId(muxPlaybackId) || muxPolicy === "fixture_public") {
    return { vodClass: "PUBLIC_VOD", reason: "fixture public playback id" };
  }

  if (!muxLookupAttempted) {
    return { vodClass: "UNKNOWN", reason: "mux lookup not attempted" };
  }

  if (muxFound === false) {
    return { vodClass: "MISSING_ASSET", reason: "mux playback id not found" };
  }

  if (muxPolicy === "signed") {
    return { vodClass: "SIGNED_VOD", reason: "mux policy signed" };
  }
  if (muxPolicy === "public") {
    return { vodClass: "PUBLIC_VOD", reason: "mux policy public" };
  }
  if (muxPolicy === "drm") {
    return { vodClass: "SIGNED_VOD", reason: "mux policy drm (treated as non-public)" };
  }

  return { vodClass: "UNKNOWN", reason: "mux policy unknown" };
}

export function decideMigrationAction(input: {
  vodClass: VodClass;
  appState: AppRecordingState;
  priorMigration: boolean;
  dryRun: boolean;
}): { action: MigrationAction; reason: string } {
  if (input.priorMigration || input.vodClass === "SIGNED_VOD") {
    return {
      action: input.dryRun ? "WOULD_SKIP" : "SKIPPED",
      reason: input.priorMigration ? "already migrated (audit)" : "already signed",
    };
  }
  if (input.vodClass === "LOCAL_ONLY") {
    return {
      action: input.dryRun ? "WOULD_SKIP" : "SKIPPED",
      reason: "local-only recording",
    };
  }
  if (input.vodClass === "MISSING_ASSET") {
    return {
      action: input.dryRun ? "WOULD_BLOCK" : "BLOCKED",
      reason: "missing mux asset",
    };
  }
  if (input.vodClass === "UNKNOWN") {
    return {
      action: input.dryRun ? "WOULD_BLOCK" : "BLOCKED",
      reason: "unknown mux state — refuse to guess",
    };
  }
  if (input.vodClass === "PUBLIC_VOD") {
    if (input.appState === "FAILED") {
      return {
        action: input.dryRun ? "WOULD_BLOCK" : "BLOCKED",
        reason: "failed recording — do not migrate for publish",
      };
    }
    return {
      action: input.dryRun ? "WOULD_MIGRATE" : "MIGRATED",
      reason: "public VOD → signed playback id",
    };
  }
  return {
    action: input.dryRun ? "WOULD_BLOCK" : "BLOCKED",
    reason: "unhandled class",
  };
}

async function loadPriorMigration(recordingId: string) {
  const row = await prisma.auditLog.findFirst({
    where: {
      action: RECORDING_MIGRATE_AUDIT_ACTION,
      entityType: "Recording",
      entityId: recordingId,
    },
    orderBy: { createdAt: "desc" },
  });
  if (!row?.metadata) return null;
  try {
    const meta = JSON.parse(row.metadata) as {
      oldPlaybackId?: string;
      newPlaybackId?: string;
      completedAt?: string;
    };
    if (!meta.oldPlaybackId || !meta.newPlaybackId) return null;
    return {
      oldPlaybackId: meta.oldPlaybackId,
      newPlaybackId: meta.newPlaybackId,
      completedAt: meta.completedAt || row.createdAt.toISOString(),
    };
  } catch {
    return null;
  }
}

export type RunMigrationOptions = {
  dryRun: boolean;
  /** When true (and not dry-run), delete old public playback ID after mapping. Staging only. */
  disableOldPublic?: boolean;
  mux?: MuxMigrationPort;
  actorId?: string | null;
  /** Limit to specific recording ids (fixtures / targeted runs). */
  recordingIds?: string[];
};

/**
 * Inventory + classify all Recording rows; optionally apply migration.
 * Dry-run never mutates Mux or DB.
 */
export async function runRecordingLegacyMigration(
  options: RunMigrationOptions,
): Promise<MigrationSummary> {
  const mux = options.mux ?? defaultMuxMigrationPort();
  const muxConfigured = mux.configured();

  const recordings = await prisma.recording.findMany({
    where: options.recordingIds?.length
      ? { id: { in: options.recordingIds } }
      : undefined,
    include: {
      lesson: {
        select: {
          id: true,
          courseId: true,
          recordingUrl: true,
          muxVodPlaybackId: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const items: RecordingInventoryItem[] = [];
  let globalMuxMode: MuxVerificationMode = muxConfigured ? "REAL" : "UNAVAILABLE";

  for (const rec of recordings) {
    const playbackId = rec.muxPlaybackId;
    const appState = mapAppRecordingState(rec.status);
    const prior = await loadPriorMigration(rec.id);

    let muxPolicy: RecordingInventoryItem["muxPolicy"] = null;
    let muxAssetId: string | null = null;
    let muxFound: boolean | null = null;
    let muxLookupAttempted = false;
    let existingSignedPlaybackId: string | null = null;
    let muxVerification: MuxVerificationMode = "UNAVAILABLE";

    if (!playbackId) {
      muxVerification = "UNAVAILABLE";
    } else if (isFixturePublicPlaybackId(playbackId)) {
      muxPolicy = "fixture_public";
      muxFound = true;
      muxLookupAttempted = true;
      muxVerification = "FIXTURE";
      if (globalMuxMode !== "REAL") globalMuxMode = "FIXTURE";
    } else if (isFixtureSignedPlaybackId(playbackId)) {
      muxPolicy = "fixture_signed";
      muxFound = true;
      muxLookupAttempted = true;
      muxVerification = "FIXTURE";
      if (globalMuxMode !== "REAL") globalMuxMode = "FIXTURE";
    } else if (playbackId.startsWith("demo_")) {
      muxLookupAttempted = true;
      muxFound = true;
      muxVerification = "FIXTURE";
      if (globalMuxMode !== "REAL") globalMuxMode = "FIXTURE";
    } else if (muxConfigured) {
      muxLookupAttempted = true;
      muxVerification = "REAL";
      globalMuxMode = "REAL";
      try {
        const info = await mux.getPlaybackInfo(playbackId);
        if (!info) {
          muxFound = false;
        } else {
          muxFound = true;
          muxPolicy = info.policy;
          muxAssetId = info.objectType === "asset" ? info.objectId : null;
          if (muxAssetId) {
            const ids = await mux.listAssetPlaybackIds(muxAssetId);
            existingSignedPlaybackId =
              ids.find((p) => p.policy === "signed")?.id ?? null;
          }
        }
      } catch {
        muxFound = null;
        muxPolicy = null;
        muxVerification = "UNAVAILABLE";
      }
    } else {
      muxLookupAttempted = false;
      muxVerification = "UNAVAILABLE";
    }

    const priorMatches =
      Boolean(prior) &&
      (prior!.newPlaybackId === playbackId ||
        (existingSignedPlaybackId != null &&
          prior!.newPlaybackId === existingSignedPlaybackId));

    const classified = classifyVodFromFacts({
      muxPlaybackId: playbackId,
      storageKey: rec.storageKey,
      muxPolicy,
      muxLookupAttempted,
      muxFound,
    });

    let vodClass = classified.vodClass;
    if (priorMatches) vodClass = "SIGNED_VOD";
    if (existingSignedPlaybackId && playbackId === existingSignedPlaybackId) {
      vodClass = "SIGNED_VOD";
    }

    const decision = decideMigrationAction({
      vodClass,
      appState,
      priorMigration: priorMatches,
      dryRun: options.dryRun,
    });

    const item: RecordingInventoryItem = {
      recordingId: rec.id,
      lessonId: rec.lessonId,
      courseId: rec.lesson.courseId,
      status: rec.status,
      muxPlaybackId: playbackId,
      storageKey: rec.storageKey,
      lessonRecordingUrl: rec.lesson.recordingUrl,
      lessonMuxVodPlaybackId: rec.lesson.muxVodPlaybackId,
      appState,
      vodClass,
      muxPolicy,
      muxAssetId,
      muxVerification,
      existingSignedPlaybackId,
      priorMigration: prior,
      action: decision.action,
      reason: decision.reason || classified.reason,
    };

    if (!options.dryRun && decision.action === "MIGRATED" && vodClass === "PUBLIC_VOD") {
      try {
        // Prefer prior audit newPlaybackId or existing signed id — never mint duplicates.
        const reuseSigned =
          existingSignedPlaybackId ||
          (prior && isFixtureSignedPlaybackId(prior.newPlaybackId)
            ? prior.newPlaybackId
            : prior?.newPlaybackId && !isFixturePublicPlaybackId(prior.newPlaybackId)
              ? prior.newPlaybackId
              : null);

        const result = await applyOneMigration({
          recordingId: rec.id,
          lessonId: rec.lessonId,
          oldPlaybackId: playbackId!,
          muxAssetId,
          existingSignedPlaybackId: reuseSigned,
          mux,
          disableOldPublic: Boolean(options.disableOldPublic),
          actorId: options.actorId ?? null,
          fixture: muxVerification === "FIXTURE",
        });
        item.action = "MIGRATED";
        item.muxPlaybackId = result.newPlaybackId;
        item.vodClass = "SIGNED_VOD";
        item.reason = result.reason;
        item.priorMigration = {
          oldPlaybackId: playbackId!,
          newPlaybackId: result.newPlaybackId,
          completedAt: new Date().toISOString(),
        };
      } catch (err) {
        item.action = "FAILED";
        item.reason = err instanceof Error ? err.message : "migration failed";
      }
    }

    items.push(item);
  }

  return summarize(items, options.dryRun, globalMuxMode);
}

async function applyOneMigration(input: {
  recordingId: string;
  lessonId: string;
  oldPlaybackId: string;
  muxAssetId: string | null;
  existingSignedPlaybackId: string | null;
  mux: MuxMigrationPort;
  disableOldPublic: boolean;
  actorId: string | null;
  fixture: boolean;
}): Promise<{ newPlaybackId: string; reason: string }> {
  let newPlaybackId: string;

  if (input.existingSignedPlaybackId) {
    newPlaybackId = input.existingSignedPlaybackId;
  } else if (input.fixture) {
    newPlaybackId = fixtureSignedPlaybackIdFromPublic(input.oldPlaybackId);
  } else {
    if (!input.muxAssetId) throw new Error("MISSING_ASSET_ID");
    newPlaybackId = await input.mux.createSignedPlaybackId(input.muxAssetId);
  }

  await prisma.$transaction(async (tx) => {
    await tx.recording.update({
      where: { id: input.recordingId },
      data: { muxPlaybackId: newPlaybackId },
    });
    await tx.lesson.update({
      where: { id: input.lessonId },
      data: { muxVodPlaybackId: newPlaybackId },
    });
  });

  await writeAuditLog({
    actorId: input.actorId,
    action: RECORDING_MIGRATE_AUDIT_ACTION,
    entityType: "Recording",
    entityId: input.recordingId,
    metadata: {
      oldPlaybackId: input.oldPlaybackId,
      newPlaybackId,
      muxAssetId: input.muxAssetId,
      fixture: input.fixture,
      disableOldPublic: input.disableOldPublic,
      completedAt: new Date().toISOString(),
    },
  });

  if (
    input.disableOldPublic &&
    !input.fixture &&
    input.muxAssetId &&
    input.oldPlaybackId !== newPlaybackId
  ) {
    await input.mux.deletePlaybackId(input.muxAssetId, input.oldPlaybackId);
  }

  return {
    newPlaybackId,
    reason: input.existingSignedPlaybackId
      ? "reused existing signed playback id"
      : input.fixture
        ? "fixture public → signed id"
        : "created signed playback id",
  };
}

function summarize(
  items: RecordingInventoryItem[],
  dryRun: boolean,
  muxVerification: MuxVerificationMode,
): MigrationSummary {
  const count = (pred: (i: RecordingInventoryItem) => boolean) =>
    items.filter(pred).length;

  return {
    TOTAL: items.length,
    PUBLIC: count((i) => i.vodClass === "PUBLIC_VOD"),
    SIGNED: count((i) => i.vodClass === "SIGNED_VOD"),
    LOCAL: count((i) => i.vodClass === "LOCAL_ONLY"),
    MISSING: count((i) => i.vodClass === "MISSING_ASSET"),
    UNKNOWN: count((i) => i.vodClass === "UNKNOWN"),
    WOULD_MIGRATE: count((i) => i.action === "WOULD_MIGRATE"),
    WOULD_SKIP: count((i) => i.action === "WOULD_SKIP"),
    WOULD_BLOCK: count((i) => i.action === "WOULD_BLOCK"),
    MIGRATED: count((i) => i.action === "MIGRATED"),
    SKIPPED: count((i) => i.action === "SKIPPED"),
    BLOCKED: count((i) => i.action === "BLOCKED"),
    FAILED: count((i) => i.action === "FAILED"),
    muxVerification,
    dryRun,
    items,
  };
}

/** Production/staging confirmation gates for apply mode. */
export function assertMigrationApplyAllowed(input: {
  apply: boolean;
  isProduction: boolean;
  confirmRecordingMigration: boolean;
  confirmProductionRecordingMigration: boolean;
  flagEnabled: boolean;
}): void {
  if (!input.apply) return;
  // Inventory/audit mode must never reach apply.
  if (
    process.env.AUDIT_ONLY === "true" ||
    process.env.RECORDING_MIGRATION_MODE === "inventory"
  ) {
    throw new Error("AUDIT_ONLY/inventory mode forbids migration apply");
  }
  if (!input.flagEnabled) {
    throw new Error("FF_RECORDING_LEGACY_MIGRATION_V1 must be true to apply");
  }
  if (!input.confirmRecordingMigration) {
    throw new Error("CONFIRM_RECORDING_MIGRATION=true required for apply");
  }
  if (input.isProduction && !input.confirmProductionRecordingMigration) {
    throw new Error(
      "CONFIRM_PRODUCTION_RECORDING_MIGRATION=true required for production apply",
    );
  }
}

export function isProductionLikeEnv(): boolean {
  // Staging process always uses port 3101 — never treat as production.
  if (process.env.PORT === "3101") return false;
  if (process.env.LEXIFY_ENV === "staging") return false;
  if (process.env.STAGING === "1") return false;

  if (process.env.LEXIFY_ENV === "production") return true;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "";
  if (/staging/i.test(appUrl)) return false;
  if (/lexify\.zonic\.fit/i.test(appUrl)) return true;
  return process.env.NODE_ENV === "production";
}
