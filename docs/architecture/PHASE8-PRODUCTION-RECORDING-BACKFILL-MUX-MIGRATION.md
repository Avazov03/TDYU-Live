# Phase 8 — Production Recording Backfill + Real Mux Signed Migration

**Status:** BLOCKED at read-only audit (Section 1–5). No mutation performed.
**Date (UTC):** 2026-09-25
**Tool:** `npm run db:recording:production-precheck -- --env-file /var/www/tdyu-live/.env` (GET-only Mux, SELECT-only DB, read-only transaction)

---

## 1. Production starting state

| Item | Value |
|------|-------|
| DB | `tdyulive` (port 3100) |
| `recordings` rows | 0 |
| `audit_logs` rows | 0 |
| Lessons with `mux_vod_playback_id` | 8 |
| Recording flags | absent (OFF) |
| PID / HTTP | 4704 / 200 |

Counts at audit: users 12, courses 6, lessons 17, payments 7, purchases 0, enrollments 0, subscriptions 6, entitlements 6, recordings 0.
(payments 6→7 and entitlements 5→6 vs the schema-alignment phase are organic production activity; this phase wrote nothing.)

## 2. The 8 legacy references — what they actually are

| # | lessonId | courseId | lesson | Mux object | stream status | recorded assets | `recording_url` | local file |
|---|----------|----------|--------|------------|---------------|-----------------|-----------------|------------|
| 1 | c3bea711-… | 15b7aee6-… | ended | live_stream | idle | 0 | — | — |
| 2 | b92c193f-… | 592a5d07-… | ended | live_stream | idle | 0 | — | — |
| 3 | 41eacc4e-… | 592a5d07-… | ended | live_stream | idle | 0 | local_path | MISSING |
| 4 | 76b954f9-… | 592a5d07-… | ended | live_stream | idle | 0 | local_path | MISSING |
| 5 | be1b580f-… | 592a5d07-… | ended | live_stream | idle | 0 | local_path | MISSING |
| 6 | 5d72d1d4-… | 592a5d07-… | ended | live_stream | idle | 0 | local_path | MISSING |
| 7 | f10b1e72-… | 592a5d07-… | ended | live_stream | idle | 0 | local_path | MISSING |
| 8 | e94b1416-… | 592a5d07-… | ended | live_stream | idle | 0 | local_path | MISSING |

Both courses: `is_published = true`, `lifecycle_status = null` (legacy flag authoritative). 0 active enrollments; course 592a5d07 has 5 legacy subscriptions.

**Finding A — no VOD assets exist.** `GET /video/v1/playback-ids/{id}` returns `object.type = live_stream` for all 8. `GET /video/v1/live-streams/{id}` returns `recent_asset_ids = []` for all 8. The column name `mux_vod_playback_id` is misleading: it holds the live stream's public playback ID. An idle live-stream playback ID serves no replay.

**Finding B — local fallback files are gone.** Six lessons reference `/uploads/recordings/<lessonId>-<ts>.webm`. The writer (`api/teacher/lessons/[id]/recording`) stores under `process.cwd()/public/uploads/recordings`; PM2 cwd is `/var/www/tdyu-live`. The directory exists (recreated 2026-09-18 07:18) but is empty, and a host-wide search found none of these files.

**Finding C — signing keys missing.** Production `.env`: `MUX_TOKEN_ID` AVAILABLE, `MUX_TOKEN_SECRET` AVAILABLE, `MUX_SIGNING_KEY_ID` MISSING, `MUX_SIGNING_PRIVATE_KEY` MISSING.

## 3. Candidate selection / validation

SAFE = 0, BLOCKED = 8. Each candidate fails Section 5 conditions 5–6 (asset not resolvable / does not exist) and 13/15 (no signing key, so the app cannot mint tokens). Section 38 stop conditions 1 and 17 triggered.

## 4. Asset resolution

0 of 8 resolved. Not guessed. `POST /video/v1/assets/{assetId}/playback-ids` requires an asset. Live-stream playback IDs cannot be re-pointed at a recording that doesn't exist.

## 5–15. Signed playback / backfill / mapping / canary / cutover

**Not executed.** No canary was possible: there is no candidate with real media. Creating `published` Recording rows would fabricate replays that cannot play (Section 6/7 forbid this).

## 16. Security matrix

Unchanged from Wave 2 (staging-verified). No production runtime change was made. The 8 public playback IDs are live-stream IDs on idle streams with no recordings, so they expose no replay content today.

## 17. Mux verification

MUX_GET 16 (8 playback-id + 8 live-stream lookups) · POST 0 · PATCH 0 · PUT 0 · DELETE 0.

## 18. Data integrity

DB writes: 0 (session forced `READ ONLY`). AuditLog: no events (nothing migrated).

## 19. Production health

PID 4704 before/after · HTTP 200 · no PM2 reload.

## 20. Final state

Identical to the starting state.

## 21. Remaining limitations / decisions needed

1. **Media recovery.** Confirm whether the 6 `.webm` files exist in any backup or the teacher's machine. If they're recovered, the correct path is Recording with `storageKey` (local, served through `api/media/recording/[id]`), not Mux signing, unless they are uploaded to Mux as new assets (a new asset must be created with `playback_policy: signed` from the start).
2. **Lessons 1–2** have no media anywhere and can't be backfilled.
3. **Signing key.** Before any real Mux signed playback in production, create a Mux signing key and add `MUX_SIGNING_KEY_ID` / `MUX_SIGNING_PRIVATE_KEY` to the production `.env` (out of repo).
4. **Future live recordings.** Wave 1 webhook flow must be enabled so new live streams produce assets that map into Recording (signed policy) automatically.
5. **Upload persistence.** `public/uploads/recordings` sits inside the deploy tree. If a deploy recreated it, new local uploads are at risk. Move it to a persistent path outside the release directory before relying on local recordings again.
6. **Old public live-stream playback IDs** can be deleted later as hygiene (explicit confirmation only). There is no replay content behind them.
