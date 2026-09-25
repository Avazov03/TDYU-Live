/**
 * Phase 8.1 — READ-ONLY media recovery audit.
 *
 * DB: SELECT only (read-only session). Mux: GET only. Filesystem: read only.
 * Searches ONLY: legacy deploy path, RECORDING_STORAGE_ROOT, and explicit
 * RECOVERY_SEARCH_PATHS (colon-separated) / --search <dir> entries.
 *
 * Usage:
 *   npm run db:recording:media-recovery-audit -- --env-file /var/www/tdyu-live/.env \
 *     [--search /home/ubuntu/backups] [--legacy-root /var/www/tdyu-live]
 */

import { execFileSync } from "child_process";
import { existsSync, readdirSync, statSync, statfsSync } from "fs";
import { open } from "fs/promises";
import path from "path";
import { Client } from "pg";
import {
  argValue,
  assertEnvConsistent,
  credentialStatus,
  dbName,
  loadScriptEnv,
} from "./recording-script-env";

loadScriptEnv();

const MAX_DEPTH = 6;

function walkForLesson(root: string, lessonId: string, depth = 0, out: string[] = []): string[] {
  if (depth > MAX_DEPTH || !existsSync(root)) return out;
  let entries: import("fs").Dirent[];
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".git" || e.name === ".next") continue;
    const p = path.join(root, e.name);
    if (e.isDirectory()) walkForLesson(p, lessonId, depth + 1, out);
    else if (e.isFile() && e.name.includes(lessonId) && /\.(webm|mp4)$/i.test(e.name)) out.push(p);
  }
  return out;
}

function ffprobe(file: string): { durationSec: number | null; video: boolean; audio: boolean; format: string | null } | null {
  try {
    const raw = execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration,format_name:stream=codec_type", "-of", "json", file],
      { encoding: "utf8", timeout: 30_000 },
    );
    const j = JSON.parse(raw) as { format?: { duration?: string; format_name?: string }; streams?: { codec_type?: string }[] };
    return {
      durationSec: j.format?.duration ? Number(j.format.duration) : null,
      video: Boolean(j.streams?.some((s) => s.codec_type === "video")),
      audio: Boolean(j.streams?.some((s) => s.codec_type === "audio")),
      format: j.format?.format_name ?? null,
    };
  } catch {
    return null;
  }
}

async function inspect(file: string) {
  const { detectRecordingContainer, sha256File } = await import("../src/lib/recording-storage");
  const fh = await open(file, "r");
  const head = Buffer.alloc(16);
  await fh.read(head, 0, 16, 0);
  await fh.close();
  return {
    size: statSync(file).size,
    sha256: await sha256File(file),
    container: detectRecordingContainer(head),
    probe: ffprobe(file),
  };
}

async function main() {
  assertEnvConsistent();
  const { readMuxPlaybackId, readMuxAsset, muxReadOnlyFetch, getMuxReadOnlyCounters } = await import(
    "../src/lib/mux-read-only"
  );
  const { classifyLegacyMedia, classifyPlaybackReference } = await import("../src/lib/recording-media-state");

  const legacyRoot = argValue("--legacy-root") || process.cwd();
  const searchRoots = [
    ...(process.env.RECOVERY_SEARCH_PATHS ?? "").split(":").filter(Boolean),
    ...(argValue("--search") ? [argValue("--search") as string] : []),
  ];
  const storageRoot = process.env.RECORDING_STORAGE_ROOT?.trim() || null;

  console.log("=== ENV ===");
  console.log(JSON.stringify({ DB_NAME: dbName(), PORT: process.env.PORT ?? null, ...credentialStatus() }, null, 2));

  console.log("=== DISK ===");
  for (const p of [legacyRoot, storageRoot].filter(Boolean) as string[]) {
    try {
      const s = statfsSync(existsSync(p) ? p : path.dirname(p));
      console.log(JSON.stringify({ path: p, freeGB: +((s.bavail * s.bsize) / 1e9).toFixed(2), totalGB: +((s.blocks * s.bsize) / 1e9).toFixed(2) }));
    } catch {
      console.log(JSON.stringify({ path: p, disk: "UNAVAILABLE" }));
    }
  }

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  await db.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY");
  const rows = (
    await db.query(`
      SELECT l.id, l.course_id, l.status::text AS status, l.mux_vod_playback_id, l.recording_url,
             (SELECT COUNT(*)::int FROM recordings r WHERE r.lesson_id = l.id) AS recordings
      FROM lessons l
      WHERE l.mux_vod_playback_id IS NOT NULL OR l.recording_url IS NOT NULL
      ORDER BY l.created_at, l.id
    `)
  ).rows;
  await db.end();

  const report: Array<Record<string, unknown> & { status: string; playbackReference: string }> = [];
  let n = 0;
  for (const r of rows) {
    n += 1;
    let objectType: "asset" | "live_stream" | null = null;
    let found = false;
    let assetReady = false;
    let liveStreamAssets: number | null = null;
    if (r.mux_vod_playback_id && process.env.MUX_TOKEN_ID) {
      const pb = await readMuxPlaybackId(r.mux_vod_playback_id);
      if (pb) {
        found = true;
        objectType = pb.objectType;
        if (pb.objectType === "asset") {
          assetReady = (await readMuxAsset(pb.objectId))?.status === "ready";
        } else {
          const res = await muxReadOnlyFetch(`/video/v1/live-streams/${encodeURIComponent(pb.objectId)}`);
          if (res.ok) {
            const j = (await res.json()) as { data: { recent_asset_ids?: string[] } };
            liveStreamAssets = j.data.recent_asset_ids?.length ?? 0;
          }
        }
      }
    }

    const expected = r.recording_url && String(r.recording_url).startsWith("/uploads/recordings/")
      ? path.join(legacyRoot, "public", r.recording_url)
      : null;
    const localHit = expected && existsSync(expected) ? expected : null;
    const backupHits = [
      ...searchRoots.flatMap((root) => walkForLesson(root, r.id)),
      ...(storageRoot ? walkForLesson(storageRoot, r.id) : []),
    ];
    const source = localHit ?? backupHits[0] ?? null;
    const media = source ? await inspect(source) : null;

    const state = classifyLegacyMedia({
      muxVodPlaybackId: r.mux_vod_playback_id,
      muxObjectType: objectType,
      muxLookupFound: found,
      muxAssetReady: assetReady,
      recordingUrl: r.recording_url,
      localFileFound: Boolean(localHit),
      backupFileFound: !localHit && backupHits.length > 0,
      mediaValid: media ? Boolean(media.container) : undefined,
    });

    report.push({
      candidate: n,
      lessonId: r.id,
      courseId: r.course_id,
      lessonStatus: r.status,
      existingRecordings: r.recordings,
      playbackReference: classifyPlaybackReference({
        muxVodPlaybackId: r.mux_vod_playback_id,
        muxObjectType: objectType,
        muxLookupFound: found,
        muxAssetReady: assetReady,
        recordingUrl: r.recording_url,
        localFileFound: false,
        backupFileFound: false,
      }),
      liveStreamRecordedAssets: liveStreamAssets,
      expectedFile: r.recording_url ?? null,
      recoverySource: localHit ? "LEGACY_DEPLOY_PATH" : backupHits.length ? "SEARCH_PATH" : null,
      fileFound: Boolean(source),
      size: media?.size ?? null,
      sha256: media?.sha256 ?? null,
      container: media?.container ?? null,
      durationSec: media?.probe?.durationSec ?? null,
      video: media?.probe?.video ?? null,
      audio: media?.probe?.audio ?? null,
      ffprobe: media ? (media.probe ? "OK" : "UNAVAILABLE") : null,
      status: state,
    });
  }

  console.log("=== CANDIDATES ===");
  for (const c of report) console.log(JSON.stringify(c));
  const by = (s: string) => report.filter((c) => c.status === s).length;
  console.log("=== SUMMARY ===");
  console.log(JSON.stringify({
    TOTAL: report.length,
    REAL_MUX_VOD: by("REAL_MUX_VOD"),
    RECOVERABLE_LOCAL_MEDIA: by("RECOVERABLE_LOCAL_MEDIA"),
    RECOVERABLE_BACKUP_MEDIA: by("RECOVERABLE_BACKUP_MEDIA"),
    MISSING_MEDIA: by("MISSING_MEDIA"),
    INVALID_LEGACY_PLAYBACK_REFERENCE: by("INVALID_LEGACY_PLAYBACK_REFERENCE"),
    NO_MEDIA: by("NO_MEDIA"),
    LEGACY_LIVE_STREAM_REFS: report.filter((c) => c.playbackReference === "LEGACY_LIVE_STREAM_PLAYBACK_REFERENCE").length,
    SEARCHED: { legacyRoot: Boolean(legacyRoot), storageRoot: Boolean(storageRoot), extraRoots: searchRoots.length },
    MUX: getMuxReadOnlyCounters(),
    DB_WRITE: 0,
    FS_WRITE: 0,
  }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
