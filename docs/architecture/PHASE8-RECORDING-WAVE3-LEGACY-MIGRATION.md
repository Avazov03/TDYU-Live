# Phase 8 / Recording Wave 3 — Legacy VOD Migration

**Status:** Staging via `FF_RECORDING_LEGACY_MIGRATION_V1=true`  
**Requires:** Wave 1 `FF_RECORDING_REVIEW_V1` + Wave 2 `FF_RECORDING_SIGNED_PLAYBACK_V1`  
**Production:** untouched — flag default **OFF**; dual confirm required for any apply.

---

## 1. Legacy recording inventory

Sources inspected:

| Source | Field | Notes |
|--------|-------|-------|
| `Recording` | `muxPlaybackId`, `storageKey`, `status` | Authoritative Wave 1 row |
| `Lesson` | `muxVodPlaybackId`, `recordingUrl` | Legacy / sync fields |
| Mux REST | playback policy + asset id | When `MUX_TOKEN_*` present |

Staging baseline (pre Wave 3 fixtures): mostly **LOCAL_ONLY** E2E uploads; orphan lesson `fixture_vod` without Recording row (reported, not auto-migrated).

---

## 2–3. Classification

| Class | Meaning |
|-------|---------|
| `PUBLIC_VOD` | Mux policy public **or** fixture `legacy_public_*` / `public_fixture_*` / `fixture_vod` |
| `SIGNED_VOD` | Mux policy signed/drm **or** fixture `legacy_signed_*` / `signed_fixture_*` |
| `LOCAL_ONLY` | `storageKey` / demo ids — not Mux migration |
| `MISSING_ASSET` | Playback id not found in Mux, or no media |
| `UNKNOWN` | Real id but Mux credentials/API unavailable — **do not guess** |

App states: `PUBLISHED` / `NOT_PUBLISHED` / `PROCESSING` / `READY` / `FAILED`.

---

## 4–8. Migration architecture

Mux cannot convert a playback ID in place. Documented API:

1. `GET /video/v1/playback-ids/{id}` → asset + policy  
2. `GET /video/v1/assets/{assetId}` → list playback ids (reuse existing signed)  
3. `POST /video/v1/assets/{assetId}/playback-ids` `{ "policy": "signed" }`  
4. Update `Recording.muxPlaybackId` + `Lesson.muxVodPlaybackId`  
5. Optional: `DELETE .../playback-ids/{oldPublicId}` (`--disable-old-public`)

State tracking: **AuditLog** action `recording.legacy_migrate_v1` with `{ oldPlaybackId, newPlaybackId, muxAssetId }` — **no schema migration**, no tokens stored.

---

## 5–6. Dry run / real migration

```bash
# Dry-run (default) — no Mux/DB writes
npm run db:recording:legacy-migrate:dry

# Apply (staging)
FF_RECORDING_LEGACY_MIGRATION_V1=true
CONFIRM_RECORDING_MIGRATION=true
npm run db:recording:legacy-migrate:apply

# Production apply (both confirms required — do not use casually)
CONFIRM_PRODUCTION_RECORDING_MIGRATION=true
```

Admin API: `POST /api/admin/recording/legacy-migrate`  
Body: `{ dryRun?: true, confirm?: true, recordingId?, disableOldPublic? }`  
Default `dryRun=true`.

Summary fields: `TOTAL PUBLIC SIGNED LOCAL MISSING UNKNOWN WOULD_MIGRATE WOULD_SKIP WOULD_BLOCK MIGRATED SKIPPED BLOCKED FAILED muxVerification`.

---

## 7. Idempotency

- Already `SIGNED_VOD` → SKIP  
- Prior AuditLog + current id match → SKIP  
- Asset already has signed playback id → **reuse** (no duplicate mint)  
- Second apply after success → SKIP  

---

## 8. Rollback

AuditLog retains `oldPlaybackId`. Reversible by pointing Recording/Lesson back to old id **before** `--disable-old-public`. Initial migration does **not** delete the Mux asset.

---

## 9–11. Staging / Mux verification / security

| Mode | When |
|------|------|
| `REAL` | `MUX_TOKEN_ID` + `MUX_TOKEN_SECRET` present and API succeeds |
| `FIXTURE` | `legacy_public_*` / fixture ids (staging without Mux) |
| `UNAVAILABLE` | No credentials / API error — refuse real mutation |

Student path unchanged (Wave 2): Enrollment + published + signed token.  
`mustUseSecureMuxPlayback()` suppresses public `player.mux.com/{id}` when Wave 2 **or** Wave 3 flag is on.

---

## 12. Production migration requirements

1. Full inventory with `REAL` Mux verification  
2. Successful staging migration + E2E  
3. Rollback plan (old ids retained until cutover)  
4. Dual confirm env vars  
5. Mapping + student playback + unauthorized deny verified  
6. Only then optional `--disable-old-public`

**Production remains untouched in this wave.**

---

## 13–16. Limitations / local / missing / failed

- Legacy public Mux IDs remain playable at CDN until deleted  
- Local uploads stay Enrollment-gated via `/api/media/recording`  
- Missing assets → BLOCK (no silent recreate)  
- FAILED recordings → BLOCK  

---

## 17–18. Tests / E2E

- Unit: `src/lib/recording-wave3-legacy.test.ts`  
- E2E: `e2e/recording/wave3-legacy-migration.spec.ts` (`E2E_RECORDING_WAVE3=1`, lesson `…049`)  
- CLI: `scripts/recording-legacy-migrate.ts`

---

## 19. Production safety

PID unchanged; no Recording migration flag; no Mux mutation; no prod reload.

---

## 20. Next phase

Optional: disable old public playback IDs in production after inventory; trim/review UX (out of scope).
