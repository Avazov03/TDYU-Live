# Phase 8 — Production Recording Schema Alignment

**Status:** Schema-only alignment (no Mux mutation, no Recording row backfill)  
**Runtime flags:** remain OFF on production

---

## 1. Production schema gap

| Item | Staging | Production (before) |
|------|---------|---------------------|
| DB | `tdyulive_staging` | `tdyulive` |
| Port | 3101 | 3100 |
| Migrations through | `20260924180000_attendance_one_open_per_session` | `20260918120000_lesson_lobby` |
| `recordings` | present | **MISSING** |
| `RecordingStatus` | present | **MISSING** |
| `live_sessions` | present | **MISSING** |
| Lesson mux VOD ids | fixtures | **8 public** (unchanged this phase) |

**Pending migrations on production:**

1. `20260923170000_phase1_target_foundation` — Recording / LiveSession / Enrollment / Purchase / AuditLog / …  
2. `20260924100000_phase23a_payment_currency_open_enrollment_unique`  
3. `20260924110000_align_legacy_runtime_schema`  
4. `20260924120000_align_lesson_assets`  
5. `20260924123000_live_session_one_active_per_lesson`  
6. `20260924180000_attendance_one_open_per_session`

---

## 2. Staging reference schema

Recording model (git / staging): `id`, `lessonId`, `liveSessionId`, `status`, `storageKey`, `muxPlaybackId`, `durationSeconds`, `readyAt`, `reviewDeadlineAt`, `publishedAt`, `autoPublished`, `failureReason`, timestamps.  
**No** `muxAssetId` / `muxLiveStreamId` columns in current Prisma (asset resolved via Mux API later).

Statuses: `not_started`, `processing`, `ready`, `teacher_review`, `published`, `failed`, `hidden`.

---

## 3. Migration selected

`prisma migrate deploy` of the six pending migrations above (exact committed SQL).  
**Not** `prisma db push`.

---

## 4. SQL safety review

- Uses `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE TYPE … EXCEPTION WHEN duplicate_object`.  
- `DROP CONSTRAINT IF EXISTS` only before re-adding FKs (not DROP TABLE of app data).  
- Additive `UPDATE` only for **new** columns (`users.account_status` / `purchase_allowed`, `payments.is_demo`, `payments.currency`).  
- No Mux SQL. No changes to `lessons.mux_vod_playback_id` values.  
- Old `lms_pivot` DROP TABLE migrations already applied historically — **not** re-run.

---

## 5. Backup verification

Procedure: `pg_dump --format=custom` to `/home/ubuntu/backups/tdyu-live/` via  
`scripts/production-recording-schema-align.sh backup`.

---

## 6–8. Fresh DB / staging / production

- Fresh: `scripts/verify-fresh-recording-migrations.sh`  
- Staging: already at latest migration; regression tests  
- Production: `scripts/production-recording-schema-align.sh deploy`

---

## 9. What this phase does NOT do

- Mux GET/POST/PATCH/PUT/DELETE during migration  
- Recording row backfill  
- Signed playback creation  
- Feature flag enablement  
- PM2 reload (unless later explicitly required)

---

## 10. Recording mapping plan (later phase)

For each of 8 production lessons with `mux_vod_playback_id`:

| Field | Proposed |
|-------|----------|
| `Recording.lessonId` | lesson id |
| `Recording.muxPlaybackId` | lesson.muxVodPlaybackId |
| `Recording.status` | `published` (candidate — confirm product intent later) |
| `Recording.storageKey` | null unless local url |

**Do not INSERT in this phase.**

---

## 11. Next phase

PRODUCTION RECORDING DATA BACKFILL + REAL MUX SIGNED MIGRATION (controlled).
