# Phase 8 — Real Mux Inventory (AUDIT ONLY)

**Status:** Audit tooling + inventory reports  
**Mutations:** NONE (Mux GET only; DB SELECT only)  
**Production migration:** NOT EXECUTED

---

## 1. Environment verification

| Signal | Staging | Production |
|--------|---------|------------|
| App path | `/var/www/tdyu-live-staging` | `/var/www/tdyu-live` |
| Port | `3101` | `3100` |
| DB | `tdyulive_staging` | production DB |
| Recording flags | Wave 1–3 ON | OFF |

Inventory environment resolution prefers `PORT=3101` / `LEXIFY_ENV=staging` before domain heuristics.

---

## 2. Production safety guard

Inventory requires:

```
AUDIT_ONLY=true
RECORDING_MIGRATION_MODE=inventory
```

Implemented in `src/lib/mux-read-only.ts` (`assertAuditOnlyInventoryMode`).

Mux client (`muxReadOnlyFetch`) **throws** on POST/PATCH/PUT/DELETE before any network call.

Wave 3 apply (`assertMigrationApplyAllowed`) **refuses** when `AUDIT_ONLY` or inventory mode is set.

CLI: `npm run db:recording:mux:inventory`  
Remote runner: `scripts/run-recording-mux-inventory.sh staging|production` (PowerShell-safe; no nested heredoc from Windows).

---

## 3–6. Database + Mux inventory

Command loads Prisma Recordings (+ orphan Lessons with mux/recordingUrl and no Recording row).

Mux (when `MUX_TOKEN_*` present):

- `GET /video/v1/playback-ids/{id}` → policy + asset/live_stream id  
- `GET /video/v1/assets/{id}` → asset status + playback id list  

No Mux mutations. Schema has **no** `muxAssetId` column — asset id comes from Mux lookup only.

---

## 7–12. Classification

| Class | Meaning |
|-------|---------|
| PUBLIC_VOD | Mux policy `public` (or fixture public) |
| SIGNED_VOD | Mux `signed`/`drm` (or fixture signed) |
| LOCAL_ONLY | `storageKey` / demo / local uploads |
| MISSING_ASSET | Playback not found / no media |
| UNKNOWN | Credentials missing or lookup failed — **not guessed as public** |
| ORPHAN_MUX_REFERENCE | Lesson mux id without Recording row |

`lesson.recordingUrl` kinds: LOCAL | MUX_PUBLIC | MUX_SIGNED | OTHER | EMPTY  
`PUBLIC_URL_REFERENCE` flagged when URL is public Mux player/stream.

---

## 13–14. Migration candidates (plan only)

| Bucket | Rule |
|--------|------|
| SAFE_CANDIDATE | Verified PUBLIC_VOD + asset id + valid lesson (+ not failed) |
| ALREADY_SIGNED | SIGNED_VOD |
| LOCAL_ONLY | Local media |
| ORPHAN / MISSING / UNKNOWN / BLOCKED | Do not migrate |

**No execution in this phase.**

---

## 15–16. Mux API migration capability (documented, not run)

Supported by Mux REST (already in `src/lib/mux.ts`):

1. `POST /video/v1/assets/{ASSET_ID}/playback-ids` `{ "policy": "signed" }` — create signed playback id  
2. Update app `Recording.muxPlaybackId` + `Lesson.muxVodPlaybackId`  
3. Verify signed playback with Wave 2 tokens  
4. Optional `DELETE /video/v1/assets/{ASSET_ID}/playback-ids/{PUBLIC_ID}` — disable old public id  

Cannot convert a playback id in place — new signed id required.

---

## 17. Rollback plan (future)

Before any production apply: AuditLog `oldPlaybackId` / `newPlaybackId` / `muxAssetId`.  
Rollback = remap app IDs to old public id **before** deleting it.  
Not proven on production in this audit.

---

## 18. Production prerequisites (future)

1. REAL Mux verification AVAILABLE  
2. Complete SAFE_CANDIDATE list  
3. Staging migration success (Wave 3)  
4. Dual confirm: `CONFIRM_RECORDING_MIGRATION` + `CONFIRM_PRODUCTION_RECORDING_MIGRATION`  
5. Rollback rehearsal  
6. Then optional `--disable-old-public`

---

## 19. Security findings

- Wave 2/3 flags off on production → learn page may still emit public `player.mux.com/{id}` for VOD when flags off (expected until cutover).  
- Staging with flags on: `mustUseSecureMuxPlayback()` suppresses public VOD iframe.  
- Media route only serves `/uploads/recordings/*` (local).  
- Cross-env Mux credential fingerprint must be DIFFERENT staging vs production.

---

## 20. Shell / PowerShell fix

Wave 3 failure mode: PowerShell parsing of bash heredocs / `$(...)`.  
Fix: repository bash scripts under `scripts/` + SCP + `bash /tmp/...` — no inline heredoc from PowerShell.

---

## 21. Explicit non-mutation statement

This audit performs:

- DB SELECT only  
- Mux GET only  

It does **not**:

- migrate production VOD  
- delete playback ids  
- change production DB/env/PM2/flags  

---

## 22. How to run

```bash
# Local / server (forces AUDIT_ONLY internally)
npm run db:recording:mux:inventory

# Remote (from Lexify server)
bash scripts/run-recording-mux-inventory.sh staging
bash scripts/run-recording-mux-inventory.sh production
```
