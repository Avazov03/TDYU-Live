# Phase 8.1 — production media recovery report

**Result: BLOCKED — 0 recoverable media. Canary not run.** Hardening shipped (see
[PHASE8.1-SIGNED-MUX-INGEST.md](./PHASE8.1-SIGNED-MUX-INGEST.md),
[../infrastructure/RECORDING-STORAGE.md](../infrastructure/RECORDING-STORAGE.md)).

All discovery was read-only: SELECT-only DB session, Mux GET only, filesystem reads only.
Production PID and HTTP 200 unchanged throughout. No DB, Mux, nginx, PM2 or file changes on production.

## Root cause

1. `/end` wrote `vodMux ?? lesson.muxLivePlaybackId` into `lessons.mux_vod_playback_id`. The 8 values are
   **live-stream playback IDs** (Mux `object.type = live_stream`, `recent_asset_ids = []`). They were never recordings.
2. Real recordings came from the browser Meet room (MediaRecorder upload) into
   `public/uploads/recordings/` inside the release directory. Deploys replaced that tree (dir mtime 2026-09-18),
   so the 6 referenced files no longer exist.

## Candidates

| # | Lesson | Course | Playback reference | recording_url | File | State |
|---|--------|--------|--------------------|---------------|------|-------|
| 1 | c3bea711-… | 15b7aee6-… | LEGACY_LIVE_STREAM_PLAYBACK_REFERENCE | — | — | MISSING_MEDIA (no media ever stored) |
| 2 | b92c193f-… | 592a5d07-… | LEGACY_LIVE_STREAM_PLAYBACK_REFERENCE | — | — | MISSING_MEDIA (no media ever stored) |
| 3 | 41eacc4e-… | 592a5d07-… | LEGACY_LIVE_STREAM_PLAYBACK_REFERENCE | local path | not found | MISSING_MEDIA |
| 4 | 76b954f9-… | 592a5d07-… | LEGACY_LIVE_STREAM_PLAYBACK_REFERENCE | local path | not found | MISSING_MEDIA |
| 5 | be1b580f-… | 592a5d07-… | LEGACY_LIVE_STREAM_PLAYBACK_REFERENCE | local path | not found | MISSING_MEDIA |
| 6 | 5d72d1d4-… | 592a5d07-… | LEGACY_LIVE_STREAM_PLAYBACK_REFERENCE | local path | not found | MISSING_MEDIA |
| 7 | f10b1e72-… | 592a5d07-… | LEGACY_LIVE_STREAM_PLAYBACK_REFERENCE | local path | not found | MISSING_MEDIA |
| 8 | e94b1416-… | 592a5d07-… | LEGACY_LIVE_STREAM_PLAYBACK_REFERENCE | local path | not found | MISSING_MEDIA |

Totals: REAL_MUX_VOD 0 · RECOVERABLE_LOCAL_MEDIA 0 · RECOVERABLE_BACKUP_MEDIA 0 · MISSING_MEDIA 8 ·
INVALID_LEGACY_PLAYBACK_REFERENCE 0 · NO_MEDIA 0. Checksums / ffprobe: not applicable (no file).

## Locations searched (safe, read-only)

| Location | Result |
|----------|--------|
| `/var/www/tdyu-live/public/uploads/recordings` | empty |
| whole filesystem, filename contains any of the 8 lesson ids | no match |
| `/home/ubuntu/backups/tdyu-live` | 51 KB pg dump only (no media) |
| `/var/backups` | OS files only |
| `/var/www/_quarantine` | no lesson-id match |
| archives (`*.tar*`, `*.zip`) | none contain recordings |
| old releases / cron backups | none exist |
| Mux live streams (`recent_asset_ids`) | 0 assets for every stream |
| Lightsail snapshots | **not checked**, AWS CLI unavailable. Operator must check the console. |
| Teacher devices / downloads | outside server scope, ask teachers |

Tools: ffprobe UNAVAILABLE on the server (audit script degrades to container sniff + sha256).
Credentials: MUX_TOKEN_ID/SECRET AVAILABLE · MUX_SIGNING_KEY_ID/PRIVATE_KEY **MISSING** · RECORDING_STORAGE_ROOT MISSING.

## Decisions

- No Recording rows, no Mux assets, no publish. The 8 legacy IDs remain untouched in `lessons`
  (not deleted, not reclassified in the DB); lesson media mappings unchanged.
- Live-stream IDs are never treated as VOD (`classifyLegacyMedia` → never `REAL_MUX_VOD`).

## Unblock path

1. Operator: check Lightsail snapshots taken before 2026-09-18 and ask the teachers for local copies.
2. Operator: create the Mux signing key and set `MUX_SIGNING_KEY_ID` / `MUX_SIGNING_PRIVATE_KEY` on the server.
3. Deploy this code, provision `RECORDING_STORAGE_ROOT` (see RECORDING-STORAGE.md), reload PM2 with `--update-env`.
4. If a real file is found: `db:recording:media-recovery-audit --search <dir>` →
   `db:recording:media-recovery --apply` (one file) → `db:recording:production-canary` (exactly one) → checkpoint.
