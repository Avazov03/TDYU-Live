/**
 * Phase 8 — READ-ONLY production precheck for Recording backfill + signed Mux migration.
 *
 * Mux: GET only (via mux-read-only). DB: SELECT only.
 * Never prints secrets. Prints presence flags only.
 *
 * Usage:
 *   npx tsx scripts/recording-production-precheck.ts --env-file /var/www/tdyu-live/.env
 */

import { config as loadEnv } from "dotenv";
import { Client } from "pg";

type Candidate = {
  n: number;
  lessonId: string;
  courseId: string;
  lessonStatus: string;
  recordingUrlPresent: boolean;
  oldPlaybackId: string;
  courseIsPublished: boolean;
  courseLifecycle: string | null;
  teacherId: string;
  activeEnrollments: number;
  activeSubscriptions: number;
  existingRecordings: number;
  muxPolicy: string | null;
  muxObjectType: string | null;
  assetId: string | null;
  assetStatus: string | null;
  assetPublicIds: number;
  assetSignedIds: number;
  recordingUrlKind: string | null;
  liveStreamStatus: string | null;
  liveStreamRecentAssets: number | null;
  liveStreamAssetStates: string[];
  verdict: "SAFE" | "BLOCKED";
  reasons: string[];
};

async function main() {
  const idx = process.argv.indexOf("--env-file");
  const envFile = idx >= 0 ? process.argv[idx + 1] : undefined;
  if (!envFile) throw new Error("--env-file required");
  loadEnv({ path: envFile, override: true });

  const dbUrl = process.env.DATABASE_URL ?? "";
  const dbName = new URL(dbUrl).pathname.replace(/^\//, "");
  if (dbName !== "tdyulive") throw new Error(`REFUSING: expected production DB tdyulive, got ${dbName}`);

  const creds = {
    MUX_TOKEN_ID: Boolean(process.env.MUX_TOKEN_ID?.trim()),
    MUX_TOKEN_SECRET: Boolean(process.env.MUX_TOKEN_SECRET?.trim()),
    MUX_SIGNING_KEY_ID: Boolean(process.env.MUX_SIGNING_KEY_ID?.trim()),
    MUX_SIGNING_PRIVATE_KEY: Boolean(process.env.MUX_SIGNING_PRIVATE_KEY?.trim()),
  };
  const flags = {
    FF_RECORDING_REVIEW_V1: process.env.FF_RECORDING_REVIEW_V1 ?? "(absent)",
    FF_RECORDING_SIGNED_PLAYBACK_V1: process.env.FF_RECORDING_SIGNED_PLAYBACK_V1 ?? "(absent)",
    FF_RECORDING_LEGACY_MIGRATION_V1: process.env.FF_RECORDING_LEGACY_MIGRATION_V1 ?? "(absent)",
  };
  console.log("=== ENV ===");
  console.log(JSON.stringify({ DB_NAME: dbName, PORT: process.env.PORT ?? null, ...Object.fromEntries(
    Object.entries(creds).map(([k, v]) => [k, v ? "AVAILABLE" : "MISSING"]),
  ), ...flags }, null, 2));

  const { readMuxPlaybackId, readMuxAsset, muxReadOnlyFetch, getMuxReadOnlyCounters } = await import(
    "../src/lib/mux-read-only"
  );

  const db = new Client({ connectionString: dbUrl });
  await db.connect();
  await db.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY");

  const counts: Record<string, number> = {};
  for (const t of [
    "users", "courses", "lessons", "payments", "purchases", "enrollments",
    "subscriptions", "entitlements", "recordings", "audit_logs",
  ]) {
    const r = await db.query(`SELECT COUNT(*)::int AS c FROM ${t}`);
    counts[t] = r.rows[0].c;
  }
  console.log("=== COUNTS ===");
  console.log(JSON.stringify(counts, null, 2));

  const rows = (
    await db.query(`
      SELECT l.id AS lesson_id, l.course_id, l.status::text AS lesson_status,
             l.mux_vod_playback_id, (l.recording_url IS NOT NULL) AS recording_url_present,
             CASE WHEN l.recording_url IS NULL THEN NULL
                  WHEN l.recording_url LIKE 'https://stream.mux.com/%' THEN 'mux_stream_url'
                  WHEN l.recording_url LIKE '/%' THEN 'local_path'
                  WHEN l.recording_url LIKE 'http%' THEN 'external_url'
                  ELSE 'other' END AS recording_url_kind,
             c.is_published, c.lifecycle_status::text AS lifecycle, c.teacher_id,
             (SELECT COUNT(*)::int FROM enrollments e WHERE e.course_id = c.id AND e.status = 'active' AND e.access_open) AS active_enrollments,
             (SELECT COUNT(*)::int FROM subscriptions s WHERE s.course_id = c.id) AS subscriptions,
             (SELECT COUNT(*)::int FROM recordings r WHERE r.lesson_id = l.id) AS existing_recordings,
             (SELECT COUNT(*)::int FROM lessons l2 WHERE l2.mux_vod_playback_id = l.mux_vod_playback_id) AS dup_refs
      FROM lessons l JOIN courses c ON c.id = l.course_id
      WHERE l.mux_vod_playback_id IS NOT NULL
      ORDER BY l.created_at, l.id
    `)
  ).rows;

  const candidates: Candidate[] = [];
  let n = 0;
  for (const row of rows) {
    n += 1;
    const reasons: string[] = [];
    const c: Candidate = {
      n,
      lessonId: row.lesson_id,
      courseId: row.course_id,
      lessonStatus: row.lesson_status,
      recordingUrlPresent: row.recording_url_present,
      oldPlaybackId: row.mux_vod_playback_id,
      courseIsPublished: row.is_published,
      courseLifecycle: row.lifecycle,
      teacherId: row.teacher_id,
      activeEnrollments: row.active_enrollments,
      activeSubscriptions: row.subscriptions,
      existingRecordings: row.existing_recordings,
      muxPolicy: null,
      muxObjectType: null,
      assetId: null,
      assetStatus: null,
      assetPublicIds: 0,
      assetSignedIds: 0,
      recordingUrlKind: row.recording_url_kind,
      liveStreamStatus: null,
      liveStreamRecentAssets: null,
      liveStreamAssetStates: [],
      verdict: "SAFE",
      reasons,
    };

    if (row.dup_refs > 1) reasons.push("playback id referenced by multiple lessons");
    if (row.existing_recordings > 0) reasons.push("recording row already exists");
    if (!row.is_published && row.lifecycle == null) reasons.push("course not published (legacy flag)");
    if (row.lifecycle != null && !["published", "upcoming", "active", "completed"].includes(row.lifecycle)) {
      reasons.push(`course lifecycle ${row.lifecycle} not student-visible`);
    }
    if (row.lesson_status !== "ended" && row.lesson_status !== "published") {
      reasons.push(`lesson status ${row.lesson_status} (legacy VOD normally on ended)`);
    }

    const pb = await readMuxPlaybackId(row.mux_vod_playback_id);
    if (!pb) {
      reasons.push("playback id not found in Mux");
    } else {
      c.muxPolicy = pb.policy;
      c.muxObjectType = pb.objectType;
      if (pb.policy !== "public") reasons.push(`policy ${pb.policy} (expected public)`);
      if (pb.objectType === "live_stream") {
        reasons.push("playback object is live_stream, not asset");
        const res = await muxReadOnlyFetch(`/video/v1/live-streams/${encodeURIComponent(pb.objectId)}`);
        if (res.ok) {
          const ls = (await res.json()) as {
            data: { status?: string; recent_asset_ids?: string[]; active_asset_id?: string };
          };
          const recent = ls.data.recent_asset_ids ?? [];
          c.liveStreamStatus = ls.data.status ?? null;
          c.liveStreamRecentAssets = recent.length;
          const statuses: string[] = [];
          for (const aid of recent) {
            const a = await readMuxAsset(aid);
            statuses.push(a ? `${a.status}:${a.playbackIds.map((p) => p.policy).join("+") || "none"}` : "missing");
          }
          c.liveStreamAssetStates = statuses;
          if (recent.length !== 1) {
            reasons.push(`live stream has ${recent.length} recorded assets (need exactly 1 to map unambiguously)`);
          }
        } else {
          reasons.push(`live stream lookup ${res.status}`);
        }
      } else if (pb.objectType !== "asset") {
        reasons.push(`playback object is ${pb.objectType}, not asset`);
      } else {
        const asset = await readMuxAsset(pb.objectId);
        if (!asset) {
          reasons.push("asset not found");
        } else {
          c.assetId = asset.assetId;
          c.assetStatus = asset.status;
          c.assetPublicIds = asset.playbackIds.filter((p) => p.policy === "public").length;
          c.assetSignedIds = asset.playbackIds.filter((p) => p.policy === "signed").length;
          if (asset.status !== "ready") reasons.push(`asset status ${asset.status}`);
          if (!asset.playbackIds.some((p) => p.id === row.mux_vod_playback_id)) {
            reasons.push("asset does not list the legacy playback id");
          }
        }
      }
    }
    if (!creds.MUX_SIGNING_KEY_ID || !creds.MUX_SIGNING_PRIVATE_KEY) {
      reasons.push("production Mux signing key MISSING (cannot mint playback tokens)");
    }
    if (reasons.length) c.verdict = "BLOCKED";
    candidates.push(c);
  }

  const assetIds = candidates.map((c) => c.assetId).filter(Boolean);
  const dupAssets = assetIds.filter((a, i) => assetIds.indexOf(a) !== i);
  for (const c of candidates) {
    if (c.assetId && dupAssets.includes(c.assetId)) {
      c.reasons.push("asset shared by multiple lessons");
      c.verdict = "BLOCKED";
    }
  }

  await db.end();

  console.log("=== CANDIDATES ===");
  for (const c of candidates) console.log(JSON.stringify(c));
  console.log("=== SUMMARY ===");
  console.log(JSON.stringify({
    TOTAL: candidates.length,
    SAFE: candidates.filter((c) => c.verdict === "SAFE").length,
    BLOCKED: candidates.filter((c) => c.verdict === "BLOCKED").length,
    ASSETS_RESOLVED: candidates.filter((c) => c.assetId).length,
    PUBLIC: candidates.filter((c) => c.muxPolicy === "public").length,
    SIGNED: candidates.filter((c) => c.muxPolicy === "signed").length,
    MISSING: candidates.filter((c) => c.muxPolicy == null).length,
    MUX: getMuxReadOnlyCounters(),
    DB_WRITE: 0,
  }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
