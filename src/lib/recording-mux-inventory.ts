/**
 * Phase 8 — Real Mux inventory (READ-ONLY).
 *
 * Builds Recording + Lesson inventory and optionally verifies Mux playback
 * policy via GET-only API. Never mutates Mux or DB.
 */

import { prisma } from "@/lib/prisma";
import {
  assertAuditOnlyInventoryMode,
  getMuxReadOnlyCounters,
  isMuxReadCredentialsPresent,
  readMuxAsset,
  readMuxPlaybackId,
  resetMuxReadOnlyCounters,
  type MuxPlaybackPolicy,
} from "@/lib/mux-read-only";
import {
  classifyVodFromFacts,
  isFixturePublicPlaybackId,
  isFixtureSignedPlaybackId,
  mapAppRecordingState,
  type VodClass,
} from "@/lib/recording-legacy-migration";
import { isProductionLikeEnv } from "@/lib/recording-legacy-migration";

export type InventoryEnvironment = "STAGING" | "PRODUCTION" | "LOCAL" | "UNKNOWN";

export type RecordingUrlKind = "LOCAL" | "MUX_PUBLIC" | "MUX_SIGNED" | "OTHER" | "EMPTY";

export type MigrationBucket =
  | "SAFE_CANDIDATE"
  | "ALREADY_SIGNED"
  | "LOCAL_ONLY"
  | "ORPHAN"
  | "MISSING"
  | "UNKNOWN"
  | "BLOCKED";

export type InventoryItem = {
  recordingId: string | null;
  lessonId: string;
  courseId: string;
  recordingStatus: string | null;
  lessonStatus: string;
  courseLifecycle: string | null;
  muxPlaybackId: string | null;
  lessonMuxVodPlaybackId: string | null;
  storageKey: string | null;
  lessonRecordingUrl: string | null;
  recordingUrlKind: RecordingUrlKind;
  muxAssetId: string | null;
  muxPolicy: MuxPlaybackPolicy | "fixture_public" | "fixture_signed" | null;
  muxObjectType: "asset" | "live_stream" | null;
  muxAssetStatus: string | null;
  vodClass: VodClass | "ORPHAN_MUX_REFERENCE";
  migrationBucket: MigrationBucket;
  reason: string;
  publicUrlReference: boolean;
};

export type InventorySummary = {
  environment: InventoryEnvironment;
  mode: "AUDIT_ONLY";
  muxApi: "AVAILABLE" | "UNAVAILABLE";
  realMuxVerification: "REAL" | "FIXTURE" | "UNAVAILABLE";
  recordingsTableMissing: boolean;
  TOTAL_RECORDINGS: number;
  TOTAL_ORPHAN_LESSONS: number;
  PUBLIC_VOD: number;
  SIGNED_VOD: number;
  LOCAL_ONLY: number;
  MISSING_ASSET: number;
  UNKNOWN: number;
  ORPHAN_MUX_REFERENCE: number;
  LEGACY_PUBLIC_VOD_PUBLISHED: number;
  ALREADY_SECURE_SIGNED: number;
  PUBLIC_URL_REFERENCE: number;
  SAFE_CANDIDATE: number;
  ALREADY_SIGNED: number;
  BLOCKED: number;
  ORPHAN: number;
  MISSING: number;
  LOCAL_BUCKET: number;
  UNKNOWN_BUCKET: number;
  muxCounters: ReturnType<typeof getMuxReadOnlyCounters>;
  dbWrite: 0;
  items: InventoryItem[];
};

export function resolveInventoryEnvironment(): InventoryEnvironment {
  if (process.env.PORT === "3101" || process.env.LEXIFY_ENV === "staging") return "STAGING";
  if (process.env.LEXIFY_ENV === "production" || isProductionLikeEnv()) return "PRODUCTION";
  if (process.env.NODE_ENV === "development" || process.env.PORT === "3000") return "LOCAL";
  return "UNKNOWN";
}

export function classifyRecordingUrl(url: string | null | undefined): RecordingUrlKind {
  if (!url || !url.trim()) return "EMPTY";
  const u = url.trim();
  if (u.startsWith("/uploads/recordings/") || u.includes("/uploads/recordings/")) return "LOCAL";
  if (/stream\.mux\.com|player\.mux\.com/i.test(u)) {
    if (/[?&]token=/i.test(u)) return "MUX_SIGNED";
    return "MUX_PUBLIC";
  }
  if (/^https?:\/\//i.test(u)) return "OTHER";
  if (u.startsWith("/")) return "LOCAL";
  return "OTHER";
}

export function decideMigrationBucket(input: {
  vodClass: VodClass | "ORPHAN_MUX_REFERENCE";
  recordingStatus: string | null;
  muxPolicy: MuxPlaybackPolicy | "fixture_public" | "fixture_signed" | null;
  muxAssetId: string | null;
  hasValidLesson: boolean;
  muxApiAvailable: boolean;
}): { bucket: MigrationBucket; reason: string } {
  if (input.vodClass === "ORPHAN_MUX_REFERENCE") {
    return { bucket: "ORPHAN", reason: "lesson mux reference without Recording row" };
  }
  if (!input.hasValidLesson) {
    return { bucket: "ORPHAN", reason: "recording without valid lesson relationship" };
  }
  if (input.vodClass === "LOCAL_ONLY") {
    return { bucket: "LOCAL_ONLY", reason: "local storage / demo" };
  }
  if (input.vodClass === "SIGNED_VOD") {
    return { bucket: "ALREADY_SIGNED", reason: "already signed or drm" };
  }
  if (input.vodClass === "MISSING_ASSET") {
    return { bucket: "MISSING", reason: "mux asset/playback missing" };
  }
  if (input.vodClass === "UNKNOWN") {
    return { bucket: "UNKNOWN", reason: "mux policy unknown — refuse SAFE" };
  }
  if (input.vodClass === "PUBLIC_VOD") {
    if (!input.muxApiAvailable && !input.muxPolicy?.toString().startsWith("fixture")) {
      return { bucket: "UNKNOWN", reason: "public only if verified; otherwise unknown" };
    }
    if (input.recordingStatus === "failed") {
      return { bucket: "BLOCKED", reason: "failed recording" };
    }
    if (!input.muxAssetId && !String(input.muxPolicy ?? "").startsWith("fixture")) {
      return { bucket: "BLOCKED", reason: "public VOD without resolved asset id" };
    }
    return {
      bucket: "SAFE_CANDIDATE",
      reason: "verified public VOD with valid mapping — plan only",
    };
  }
  return { bucket: "BLOCKED", reason: "unhandled class" };
}

export type RunInventoryOptions = {
  /** When false, skip Mux GET (DB-only). Default: call Mux when credentials present. */
  queryMux?: boolean;
  /** Include lessons with muxVodPlaybackId but no Recording row. */
  includeOrphanLessons?: boolean;
};

/**
 * READ-ONLY inventory. Requires AUDIT_ONLY=true and RECORDING_MIGRATION_MODE=inventory.
 */
export async function runRecordingMuxInventory(
  options: RunInventoryOptions = {},
): Promise<InventorySummary> {
  assertAuditOnlyInventoryMode();
  resetMuxReadOnlyCounters();

  const environment = resolveInventoryEnvironment();
  const muxConfigured = isMuxReadCredentialsPresent();
  const queryMux = options.queryMux !== false && muxConfigured;
  const includeOrphans = options.includeOrphanLessons !== false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let recordings: any[] = [];
  let recordingsTableMissing = false;
  try {
    recordings = await prisma.recording.findMany({
      include: {
        lesson: {
          select: {
            id: true,
            courseId: true,
            status: true,
            recordingUrl: true,
            muxVodPlaybackId: true,
            course: { select: { id: true, lifecycleStatus: true, isPublished: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/recordings/i.test(msg) && /does not exist/i.test(msg)) {
      recordingsTableMissing = true;
      recordings = [];
    } else {
      throw err;
    }
  }

  const items: InventoryItem[] = [];
  let realMux: "REAL" | "FIXTURE" | "UNAVAILABLE" = muxConfigured ? "REAL" : "UNAVAILABLE";

  for (const rec of recordings) {
    const lesson = rec.lesson;
    const hasValidLesson = Boolean(lesson?.id && lesson?.courseId);
    const playbackId = rec.muxPlaybackId;
    const urlKind = classifyRecordingUrl(lesson?.recordingUrl ?? rec.storageKey);
    const publicUrlReference = urlKind === "MUX_PUBLIC";

    let muxPolicy: InventoryItem["muxPolicy"] = null;
    let muxAssetId: string | null = null;
    let muxObjectType: "asset" | "live_stream" | null = null;
    let muxAssetStatus: string | null = null;
    let muxLookupAttempted = false;
    let muxFound: boolean | null = null;

    if (!playbackId) {
      // local or empty
    } else if (isFixturePublicPlaybackId(playbackId)) {
      muxPolicy = "fixture_public";
      muxLookupAttempted = true;
      muxFound = true;
      if (realMux !== "REAL") realMux = "FIXTURE";
    } else if (isFixtureSignedPlaybackId(playbackId)) {
      muxPolicy = "fixture_signed";
      muxLookupAttempted = true;
      muxFound = true;
      if (realMux !== "REAL") realMux = "FIXTURE";
    } else if (playbackId.startsWith("demo_")) {
      muxLookupAttempted = true;
      muxFound = true;
      if (realMux !== "REAL") realMux = "FIXTURE";
    } else if (queryMux) {
      muxLookupAttempted = true;
      realMux = "REAL";
      try {
        const info = await readMuxPlaybackId(playbackId);
        if (!info) {
          muxFound = false;
        } else {
          muxFound = true;
          muxPolicy = info.policy;
          muxObjectType = info.objectType;
          muxAssetId = info.objectType === "asset" ? info.objectId : null;
          if (muxAssetId) {
            const asset = await readMuxAsset(muxAssetId);
            muxAssetStatus = asset?.status ?? null;
          }
        }
      } catch {
        muxFound = null;
        muxPolicy = null;
      }
    } else {
      muxLookupAttempted = false;
    }

    const classified = classifyVodFromFacts({
      muxPlaybackId: playbackId,
      storageKey: rec.storageKey,
      muxPolicy,
      muxLookupAttempted,
      muxFound,
    });

    const bucket = decideMigrationBucket({
      vodClass: classified.vodClass,
      recordingStatus: rec.status,
      muxPolicy,
      muxAssetId,
      hasValidLesson,
      muxApiAvailable: queryMux,
    });

    items.push({
      recordingId: rec.id,
      lessonId: lesson?.id ?? rec.lessonId,
      courseId: lesson?.courseId ?? "UNKNOWN",
      recordingStatus: rec.status,
      lessonStatus: lesson?.status ?? "UNKNOWN",
      courseLifecycle:
        lesson?.course?.lifecycleStatus ??
        (lesson?.course?.isPublished === false ? "unpublished_legacy" : "published_legacy"),
      muxPlaybackId: playbackId,
      lessonMuxVodPlaybackId: lesson?.muxVodPlaybackId ?? null,
      storageKey: rec.storageKey,
      lessonRecordingUrl: lesson?.recordingUrl ?? null,
      recordingUrlKind: urlKind,
      muxAssetId,
      muxPolicy,
      muxObjectType,
      muxAssetStatus,
      vodClass: classified.vodClass,
      migrationBucket: bucket.bucket,
      reason: `${classified.reason}; ${bucket.reason}`,
      publicUrlReference,
    });
  }

  if (includeOrphans) {
    type LessonRow = {
      id: string;
      courseId: string;
      status: string;
      recordingUrl: string | null;
      muxVodPlaybackId: string | null;
      courseLifecycle: string | null;
      coursePublished: boolean | null;
    };

    let orphans: LessonRow[] = [];
    try {
      orphans = await prisma.lesson.findMany({
        where: {
          OR: [
            { muxVodPlaybackId: { not: null } },
            { recordingUrl: { not: null } },
          ],
          ...(recordingsTableMissing ? {} : { recordings: { none: {} } }),
        },
        select: {
          id: true,
          courseId: true,
          status: true,
          recordingUrl: true,
          muxVodPlaybackId: true,
          course: { select: { lifecycleStatus: true, isPublished: true } },
        },
        take: 500,
      }).then((rows) =>
        rows.map((l) => ({
          id: l.id,
          courseId: l.courseId,
          status: l.status,
          recordingUrl: l.recordingUrl,
          muxVodPlaybackId: l.muxVodPlaybackId,
          courseLifecycle: l.course?.lifecycleStatus ?? null,
          coursePublished: l.course?.isPublished ?? null,
        })),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Production may lack lifecycle_status / recordings relation — raw SELECT fallback.
      if (/does not exist/i.test(msg) || /lifecycle_status/i.test(msg) || /recordings/i.test(msg)) {
        orphans = await prisma.$queryRawUnsafe<LessonRow[]>(
          `SELECT l.id,
                  l.course_id AS "courseId",
                  l.status::text AS status,
                  l.recording_url AS "recordingUrl",
                  l.mux_vod_playback_id AS "muxVodPlaybackId",
                  NULL::text AS "courseLifecycle",
                  c.is_published AS "coursePublished"
           FROM lessons l
           JOIN courses c ON c.id = l.course_id
           WHERE l.mux_vod_playback_id IS NOT NULL OR l.recording_url IS NOT NULL
           ORDER BY l.scheduled_at DESC NULLS LAST
           LIMIT 500`,
        );
      } else {
        throw err;
      }
    }

    for (const lesson of orphans) {
      const hasMux = Boolean(lesson.muxVodPlaybackId);
      const urlKind = classifyRecordingUrl(lesson.recordingUrl);
      const publicUrlReference = urlKind === "MUX_PUBLIC";
      let muxPolicy: InventoryItem["muxPolicy"] = null;
      let muxAssetId: string | null = null;
      let muxObjectType: "asset" | "live_stream" | null = null;
      let muxAssetStatus: string | null = null;
      let vodClass: VodClass | "ORPHAN_MUX_REFERENCE" = hasMux
        ? recordingsTableMissing
          ? "UNKNOWN"
          : "ORPHAN_MUX_REFERENCE"
        : lesson.recordingUrl
          ? "LOCAL_ONLY"
          : "MISSING_ASSET";

      if (hasMux && lesson.muxVodPlaybackId) {
        const pid = lesson.muxVodPlaybackId;
        if (isFixturePublicPlaybackId(pid)) {
          muxPolicy = "fixture_public";
          vodClass = "PUBLIC_VOD";
          if (realMux !== "REAL") realMux = "FIXTURE";
        } else if (isFixtureSignedPlaybackId(pid)) {
          muxPolicy = "fixture_signed";
          vodClass = "SIGNED_VOD";
          if (realMux !== "REAL") realMux = "FIXTURE";
        } else if (queryMux && !pid.startsWith("demo_")) {
          try {
            const info = await readMuxPlaybackId(pid);
            if (info) {
              muxPolicy = info.policy;
              muxObjectType = info.objectType;
              muxAssetId = info.objectType === "asset" ? info.objectId : null;
              if (muxAssetId) {
                const asset = await readMuxAsset(muxAssetId);
                muxAssetStatus = asset?.status ?? null;
              }
              const classified = classifyVodFromFacts({
                muxPlaybackId: pid,
                storageKey: null,
                muxPolicy,
                muxLookupAttempted: true,
                muxFound: true,
              });
              vodClass = recordingsTableMissing
                ? classified.vodClass
                : "ORPHAN_MUX_REFERENCE";
            } else {
              vodClass = "MISSING_ASSET";
            }
          } catch {
            vodClass = "UNKNOWN";
          }
        } else if (!queryMux && !isFixturePublicPlaybackId(pid) && !isFixtureSignedPlaybackId(pid)) {
          vodClass = recordingsTableMissing ? "UNKNOWN" : "ORPHAN_MUX_REFERENCE";
        }
      }

      const bucket = decideMigrationBucket({
        vodClass,
        recordingStatus: recordingsTableMissing ? "published" : null,
        muxPolicy,
        muxAssetId,
        hasValidLesson: true,
        muxApiAvailable: queryMux,
      });

      let migrationBucket = bucket.bucket;
      let reason = recordingsTableMissing
        ? `legacy lesson media (recordings table missing); ${bucket.reason}`
        : `orphan lesson media; ${bucket.reason}`;

      if (!recordingsTableMissing) {
        migrationBucket = "ORPHAN";
        reason = `orphan lesson media; ${bucket.reason}`;
        if (hasMux) vodClass = "ORPHAN_MUX_REFERENCE";
      } else if (migrationBucket === "SAFE_CANDIDATE") {
        migrationBucket = "BLOCKED";
        reason += "; blocked until recordings table exists on production";
      }

      items.push({
        recordingId: null,
        lessonId: lesson.id,
        courseId: lesson.courseId,
        recordingStatus: null,
        lessonStatus: lesson.status,
        courseLifecycle:
          lesson.courseLifecycle ??
          (lesson.coursePublished === false ? "unpublished_legacy" : "published_legacy"),
        muxPlaybackId: lesson.muxVodPlaybackId,
        lessonMuxVodPlaybackId: lesson.muxVodPlaybackId,
        storageKey: null,
        lessonRecordingUrl: lesson.recordingUrl,
        recordingUrlKind: urlKind,
        muxAssetId,
        muxPolicy,
        muxObjectType,
        muxAssetStatus,
        vodClass,
        migrationBucket,
        reason,
        publicUrlReference,
      });
    }
  }

  const count = (pred: (i: InventoryItem) => boolean) => items.filter(pred).length;
  const recordingItems = items.filter((i) => i.recordingId);

  return {
    environment,
    mode: "AUDIT_ONLY",
    muxApi: muxConfigured ? "AVAILABLE" : "UNAVAILABLE",
    realMuxVerification: realMux,
    recordingsTableMissing,
    TOTAL_RECORDINGS: recordingItems.length,
    TOTAL_ORPHAN_LESSONS: items.length - recordingItems.length,
    PUBLIC_VOD: count((i) => i.vodClass === "PUBLIC_VOD"),
    SIGNED_VOD: count((i) => i.vodClass === "SIGNED_VOD"),
    LOCAL_ONLY: count((i) => i.vodClass === "LOCAL_ONLY"),
    MISSING_ASSET: count((i) => i.vodClass === "MISSING_ASSET"),
    UNKNOWN: count((i) => i.vodClass === "UNKNOWN"),
    ORPHAN_MUX_REFERENCE: count((i) => i.vodClass === "ORPHAN_MUX_REFERENCE"),
    LEGACY_PUBLIC_VOD_PUBLISHED: count(
      (i) => i.vodClass === "PUBLIC_VOD" && i.recordingStatus === "published",
    ),
    ALREADY_SECURE_SIGNED: count(
      (i) => i.vodClass === "SIGNED_VOD" && i.recordingStatus === "published",
    ),
    PUBLIC_URL_REFERENCE: count((i) => i.publicUrlReference),
    SAFE_CANDIDATE: count((i) => i.migrationBucket === "SAFE_CANDIDATE"),
    ALREADY_SIGNED: count((i) => i.migrationBucket === "ALREADY_SIGNED"),
    BLOCKED: count((i) => i.migrationBucket === "BLOCKED"),
    ORPHAN: count((i) => i.migrationBucket === "ORPHAN"),
    MISSING: count((i) => i.migrationBucket === "MISSING"),
    LOCAL_BUCKET: count((i) => i.migrationBucket === "LOCAL_ONLY"),
    UNKNOWN_BUCKET: count((i) => i.migrationBucket === "UNKNOWN"),
    muxCounters: getMuxReadOnlyCounters(),
    dbWrite: 0,
    items,
  };
}

/** Safe env summary for reports — never includes secrets. */
export function safeEnvFingerprint(): Record<string, string | boolean> {
  return {
    PORT: process.env.PORT ?? "unset",
    NODE_ENV: process.env.NODE_ENV ?? "unset",
    LEXIFY_ENV: process.env.LEXIFY_ENV ?? "unset",
    AUDIT_ONLY: process.env.AUDIT_ONLY === "true",
    RECORDING_MIGRATION_MODE: process.env.RECORDING_MIGRATION_MODE ?? "unset",
    FF_RECORDING_REVIEW_V1: process.env.FF_RECORDING_REVIEW_V1 === "true",
    FF_RECORDING_SIGNED_PLAYBACK_V1: process.env.FF_RECORDING_SIGNED_PLAYBACK_V1 === "true",
    FF_RECORDING_LEGACY_MIGRATION_V1: process.env.FF_RECORDING_LEGACY_MIGRATION_V1 === "true",
    MUX_TOKEN_ID_PRESENT: Boolean(process.env.MUX_TOKEN_ID?.trim()),
    MUX_TOKEN_SECRET_PRESENT: Boolean(process.env.MUX_TOKEN_SECRET?.trim()),
    MUX_SIGNING_KEY_ID_PRESENT: Boolean(process.env.MUX_SIGNING_KEY_ID?.trim()),
    MUX_SIGNING_PRIVATE_KEY_PRESENT: Boolean(process.env.MUX_SIGNING_PRIVATE_KEY?.trim()),
    inventoryEnvironment: resolveInventoryEnvironment(),
  };
}
