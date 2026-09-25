# Phase 8 вЂ” Production Recording Schema Alignment

**Status:** PASS (schema only)
**Date (UTC):** 2026-09-25
**Git HEAD used for migrate:** `205afa6962cf037cb16cdd9dfe4e205bf41de3ec`
**Runtime flags on production:** OFF (no `FF_RECORDING_*` in `/var/www/tdyu-live/.env`)
**PM2:** PID `4704` unchanged В· no reload
**HTTP:** `https://lexify.zonic.fit/` в†’ 200

---

## 1. Production schema gap (before)

| Item | Staging / git | Production (before) |
|------|---------------|---------------------|
| DB | `tdyulive_staging` | `tdyulive` |
| Port | 3101 | 3100 |
| Migrations through | `20260924180000_attendance_one_open_per_session` | `20260918120000_lesson_lobby` |
| `recordings` | present | **MISSING** |
| `RecordingStatus` | present | **MISSING** |
| `live_sessions` | present | **MISSING** |
| `purchases` / `enrollments` | present | **MISSING** |
| Lesson mux VOD ids | fixtures | **8 public** |

**PRODUCTION_SCHEMA_GAP_REPORT вЂ” pending migrations:**

1. `20260923170000_phase1_target_foundation` вЂ” Recording / LiveSession / Enrollment / Purchase / AuditLog / Incident / вЂ¦
2. `20260924100000_phase23a_payment_currency_open_enrollment_unique`
3. `20260924110000_align_legacy_runtime_schema`
4. `20260924120000_align_lesson_assets`
5. `20260924123000_live_session_one_active_per_lesson`
6. `20260924180000_attendance_one_open_per_session`

---

## 2. Staging reference schema

Recording columns (Prisma / staging):
`id`, `lessonId`, `liveSessionId`, `status`, `storageKey`, `muxPlaybackId`, `durationSeconds`, `readyAt`, `reviewDeadlineAt`, `publishedAt`, `autoPublished`, `failureReason`, `createdAt`, `updatedAt`.

**No** `muxAssetId` / `muxLiveStreamId` columns in current schema.

`RecordingStatus`: `not_started`, `processing`, `ready`, `teacher_review`, `published`, `failed`, `hidden`.

---

## 3. Migration selected

`prisma migrate deploy` of the six pending migrations (exact committed SQL).
**Not** `prisma db push`.

Scripts:

- `scripts/verify-fresh-recording-migrations.sh`
- `scripts/production-recording-schema-align.sh` (`backup` | `counts` | `deploy` | `verify`)

---

## 4. SQL safety review

| Kind | Present in pending SQL? | Notes |
|------|-------------------------|-------|
| `CREATE TABLE` / `CREATE TYPE` / `CREATE INDEX` | Yes | Additive / IF NOT EXISTS |
| `ALTER TABLE вЂ¦ ADD COLUMN` | Yes | Additive |
| `DROP TABLE` / `TRUNCATE` / `DELETE` of app data | **No** in pending set | Old `lms_pivot` DROPs already applied historically |
| `UPDATE` | Yes (new columns only) | `users.purchase_allowed` / `account_status`; `payments.is_demo`; `payments.currency` |
| Mux mutation | **No** | |
| Lesson `mux_vod_playback_id` rewrite | **No** | Verified identical before/after |

FK `recordings_lesson_id_fkey` uses `ON DELETE CASCADE` вЂ” matches validated staging schema (empty `recordings` at apply time в†’ no data risk).

---

## 5. Backup verification

| Field | Value |
|-------|-------|
| BACKUP_VERIFIED | **YES** |
| Path | `/home/ubuntu/backups/tdyu-live/tdyulive-pre-recording-schema-20260925T052415Z.dump` |
| Format | `pg_dump --format=custom` |
| Size | ~51K |

---

## 6. Fresh DB migration verification

`scripts/verify-fresh-recording-migrations.sh` on disposable `tdyulive_migrate_verify`:

- All **11** migrations applied cleanly
- `recordings` present
- `RecordingStatus` present
- DB dropped after verify
- **FRESH_MIGRATE_OK**

---

## 7. Staging rehearsal

- Staging migrate status: **up to date** (already had target schema)
- Regression after align tooling checkout:

| Suite | Result |
|-------|--------|
| `test:recording` | 49/49 PASS |
| `test:access` | 138/138 PASS |
| `test:live` | 36/36 PASS |
| `test:checkout-v2` | 45/45 PASS |
| `type-check` | PASS (local; staging Node OOM on `tsc`) |

### Browser E2E (staging)

Attempted against `http://127.0.0.1:3101` after Chromium + `install-deps`.
**Skipped:** staging `.env` lacked `E2E_STUDENT_*` / teacher creds at run time (`STUDENT=MISSING`).
No production E2E. Prior Phase 8 Wave 1вЂ“3 E2E PASS on staging remains the last successful browser suite for Recording. Unit suites above are authoritative for this schema-only phase.

---

## 8. Production migration

| Field | Value |
|-------|-------|
| Target DB | `tdyulive` @ `127.0.0.1` |
| Env | production / port 3100 |
| PID before | 4704 |
| Applied | 6 migrations (listed in В§1) |
| Result | **DEPLOY_OK** |
| PID after | 4704 (unchanged) |
| HTTP after | 200 |
| PM2 reload | **none** |

---

## 9. Data integrity (before в†’ after)

| Table | Before | After |
|-------|--------|-------|
| users | 12 | 12 |
| courses | 6 | 6 |
| lessons | 17 | 17 |
| payments | 6 | 6 |
| subscriptions | 6 | 6 |
| entitlements | 5 | 5 |
| purchases | ABSENT | **0 rows** (table created) |
| enrollments | ABSENT | **0 rows** (table created) |
| recordings | ABSENT | **0 rows** (table created) |
| live_sessions | ABSENT | **0 rows** (table created) |

Schema backfill only on **new** columns (`payments.is_demo`, `payments.currency`, user account fields). Row counts unchanged. No Recording inserts.

---

## 10. Mux state

### During schema migration

MUX_GET=0 В· MUX_POST=0 В· MUX_PATCH=0 В· MUX_PUT=0 В· MUX_DELETE=0

### 8 lesson playback IDs

**MUX_IDS_UNCHANGED=YES** (identical before/after).

### Post-align read-only inventory (`AUDIT_ONLY`)

| Metric | Value |
|--------|-------|
| REAL_MUX_VERIFICATION | REAL |
| RECORDINGS_TABLE_MISSING | false |
| Recording rows | 0 |
| Lesson orphans | 8 |
| PUBLIC policies observed | 8 |
| SIGNED | 0 |
| MUX_GET (inventory only) | 8 |
| MUX_POST/PATCH/PUT/DELETE | 0 |
| DB_WRITE | 0 |

Inventory still classifies the 8 as `ORPHAN_MUX_REFERENCE` / lesson-only media until controlled backfill. Phase label: **LEGACY_LESSON_MEDIA** (not migrated).

> Inventory process may print staging feature-flag defaults if invoked from the staging tree; production `.env` has **no** `FF_RECORDING_*` keys (confirmed `PROD_RECORDING_FF=none`).

---

## 11. Recording mapping plan (NO INSERT)

Candidates: **8**. Proposed status for later backfill: `published`. Classification until then: `LEGACY_LESSON_MEDIA`.

| lessonId | courseId | proposed muxPlaybackId |
|----------|----------|------------------------|
| 41eacc4e-6096-4c25-9cf7-293a2e0a9115 | 592a5d07-a1d5-4d2d-af0e-2866f377cd4e | uxLuW0051PJy8ToVQNAvAvRwRMJY4BRWCoLCIcX1cDAg |
| 5d72d1d4-82ea-4b20-a9fd-19bb53f63201 | 592a5d07-a1d5-4d2d-af0e-2866f377cd4e | F8F01uB02MJtxUiUzFwiOze6U3G2VH7R01kdvLKHNUQAEo |
| 76b954f9-0a63-487a-a8e7-aa77e82af9d5 | 592a5d07-a1d5-4d2d-af0e-2866f377cd4e | 005sJ6V3soXr3zVSskGvmi4xCNl6jE9kBdc9d02jy3Uwg |
| b92c193f-aee3-4e5d-9242-0ca96950b3b9 | 592a5d07-a1d5-4d2d-af0e-2866f377cd4e | 00MgooBtb00qZTc02TBGnMEsLM5KvFLM017ac0200VAfsRUb4 |
| be1b580f-9a96-49eb-905b-22f256ca500d | 592a5d07-a1d5-4d2d-af0e-2866f377cd4e | MXDZoj02ll41gyF5E5gwUHl007ewDYPRGGGvJ256HkQW8 |
| c3bea711-c607-4d08-9291-57b6ebe227d8 | 15b7aee6-6ccb-43df-baf9-737ee7da4038 | q900VBIreGOGN3oaPULZyxatxrk4j9TM5o024ZFV6PznE |
| e94b1416-4322-49a2-84b9-7094e5dde411 | 592a5d07-a1d5-4d2d-af0e-2866f377cd4e | fFBKPN02bYI02VJyOpe02uPpuPdJjyM56LUmdLuvkUqQB8 |
| f10b1e72-35be-4912-9c87-56be49b71ba3 | 592a5d07-a1d5-4d2d-af0e-2866f377cd4e | a4O5AyZMxj1XMZYEsH5HNTOcUm28G02AyEdowIV8c3Zo |

---

## 12. Feature flags (production)

| Flag | Production |
|------|------------|
| FF_RECORDING_REVIEW_V1 | OFF (absent) |
| FF_RECORDING_SIGNED_PLAYBACK_V1 | OFF (absent) |
| FF_RECORDING_LEGACY_MIGRATION_V1 | OFF (absent) |

---

## 13. Production health

PID **4704** В· HTTP **200** В· PM2 **not reloaded** В· app healthy.

---

## 14. What was NOT changed

- Mux assets / playback IDs / policies
- Lesson `mux_vod_playback_id` / `recording_url` values
- Recording rows (still 0)
- Enrollment / purchase / payment **row counts**
- Production feature flags
- Production PM2 process
- Application code on production runtime beyond migration SQL

---

## 15. Rollback considerations

1. Restore `pg_dump` custom backup above (`pg_restore`).
2. Or manually `DROP` additive tables/enums/indexes listed in Phase 1 / 2.3A / 2.4A / 4 / 7 migration headers (destructive вЂ” prefer restore).
3. Do **not** attempt Mux rollback (nothing Mux-side changed).

---

## 16. Next migration step

**PRODUCTION RECORDING DATA BACKFILL + REAL MUX SIGNED MIGRATION** (controlled).
Do **not** execute in this phase.
