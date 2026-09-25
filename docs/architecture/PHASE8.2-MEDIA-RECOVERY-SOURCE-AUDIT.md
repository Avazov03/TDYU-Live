# Phase 8.2 — production media recovery source audit

**Result: 0 recoverable from any server-reachable source. 8/8 `MISSING_MEDIA`.**
The only remaining candidate source is a **Lightsail instance snapshot**. It is not visible from the server,
so an operator has to check it in the AWS console.

All checks were read-only:
- DB sessions had `default_transaction_read_only=on`.
- Mux: 16 GETs, 0 mutations.
- The filesystem was only read; nothing was written to the app tree or storage. Temp scripts were removed.
- Production PID 128631 and HTTP 200 were unchanged from start to end.

## Production baseline (2026-09-25)

| Item | Value |
|------|-------|
| Code | `6283cd7` + storage hotfix `28602ae` (build `eVgyD-am5aRcH9BO4rvli`). `3dd1aa7` is **not** deployed |
| Storage | `/var/lib/tdyu-live/recordings`, `ubuntu:ubuntu` 750, ext4 on `/dev/root`, 0 entries, `RECORDING_STORAGE_ROOT` CONFIGURED |
| Disk | 38 G total, 15 G used, 23 G free |
| Rows | users 12, courses 6, lessons 17, payments 7, subscriptions 6, entitlements 6, **recordings 0** |
| Flags | `FF_RECORDING_REVIEW_V1`, `_SIGNED_PLAYBACK_V1`, `_LEGACY_MIGRATION_V1`, `_MUX_INGEST_V1`: all OFF |

## When the files existed and when they were lost

| Evidence | Meaning |
|----------|---------|
| File timestamps in `recording_url` | 5 created 2026-09-09 11:42–12:39 UTC; `e94b1416` created 2026-09-14 10:12 UTC |
| nginx logs: 9× `POST …/e94b1416…/recording` → 200 on 2026-09-14 10:09–10:12 | uploads succeeded |
| nginx logs: `GET /api/media/recording/f10b1e72…` (253× 206) and `be1b580f…` (2× 206) on 2026-09-14 | files were being served then |
| `public/uploads/recordings` dir mtime 2026-09-18 10:16 UTC; build 10:22 | files deleted **inside** the directory ~5 min before that build |
| `public/uploads/lessons/*` attachments from 2026-09-09 still present | the tree was not wholesale replaced; the recordings were removed specifically |

**Snapshot window that would contain the media:**
- Created between **2026-09-14 10:12 UTC and 2026-09-18 10:16 UTC**: all 6 files.
- Created between 2026-09-09 12:40 and 2026-09-14 10:12 UTC: 5 files (not `e94b1416`).

## Sources inspected

| Source | Result |
|--------|--------|
| Lightsail snapshots via server | **UNAVAILABLE.** No `aws`/`lightsail` CLI. The instance role `AmazonLightsailInstanceRole` (`i-0cbcf890d21945a3d`, eu-central-1) gets `AccessDenied` on `GetInstanceSnapshots`, `GetInstances` and `GetDiskSnapshots` |
| Other backup tooling | none: no s3cmd, rclone, restic, borg or duplicity; no `~/.aws`, no `AWS_*` env |
| Scheduled backups | none for the app (cron: certbot, e2scrub, sysstat; only timer `dpkg-db-backup`) |
| Mounted / network volumes | none (single 40 G NVMe; no nfs/cifs/s3fs) |
| `/home/ubuntu/backups/tdyu-live` | pg dump (2026-09-25) plus the Phase 8.1 pre-deploy app tarball; the only recordings entry is `.gitkeep` |
| `/var/backups` | OS files only (`alternatives.tar.*`) |
| `/var/www/_quarantine` | no media |
| `/var/www/tdyu-live-prev-81` (tree before 8.1) | `uploads/recordings` holds only `.gitkeep`; lesson-id matches are lesson **attachments** (docx/pdf/svg), not recordings |
| `/opt/tdyu-fresh` | a different project (`tdyu-endowment`); no recordings |
| Persistent storage `/var/lib/tdyu-live/recordings` | created 2026-09-25, empty, no history |
| Mux live streams | all 8 `live_stream`, idle, `recent_asset_ids = []` |
| ffprobe | UNAVAILABLE (not installed; not installed by this audit) |

## Candidates

| # | Lesson | Course | Expected file | Source | Found | Size | SHA256 | Duration | Format | Status |
|---|--------|--------|---------------|--------|-------|------|--------|----------|--------|--------|
| 1 | c3bea711 | 15b7aee6 | none (no recording_url) | none | no | — | — | — | — | MISSING_MEDIA |
| 2 | b92c193f | 592a5d07 | none (no recording_url) | none | no | — | — | — | — | MISSING_MEDIA |
| 3 | 41eacc4e | 592a5d07 | `/uploads/recordings/41eacc4e-…-1788954137648.webm` | snapshot? (unverified) | no | — | — | — | — | MISSING_MEDIA |
| 4 | 76b954f9 | 592a5d07 | `…-1788955002092.webm` | snapshot? (unverified) | no | — | — | — | — | MISSING_MEDIA |
| 5 | be1b580f | 592a5d07 | `…-1788955920631.webm` | snapshot? (unverified) | no | — | — | — | — | MISSING_MEDIA |
| 6 | 5d72d1d4 | 592a5d07 | `…-1788956736245.webm` | snapshot? (unverified) | no | — | — | — | — | MISSING_MEDIA |
| 7 | f10b1e72 | 592a5d07 | `…-1788957591893.webm` | snapshot? (unverified) | no | — | — | — | — | MISSING_MEDIA |
| 8 | e94b1416 | 592a5d07 | `…-1789380725801.webm` | snapshot? (unverified) | no | — | — | — | — | MISSING_MEDIA |

- All 8 lessons: status `ended`; course `is_published = true`; `lifecycle_status` null (legacy); 0 Recording rows.
- All 8 playback references: `LEGACY_LIVE_STREAM_REFERENCE`, never VOD.
- Candidates 1–2 never had a stored file. They stay `MISSING_MEDIA` permanently.
- Candidates 3–8 become `RECOVERABLE_SNAPSHOT` only if an operator confirms a snapshot inside the window above.

## Canary manifest

**Not prepared: no validated media exists.** `RECOVERY_CANARY_001` stays unassigned.

## Operator steps to unlock recovery (no restore in place)

1. In the Lightsail console (eu-central-1), open instance snapshots and automatic snapshots for this instance.
   Look for a snapshot created between 2026-09-14 10:12 and 2026-09-18 10:16 UTC.
2. If one exists, create a **new temporary instance** from it. Never restore over production.
   Copy `/var/www/tdyu-live/public/uploads/recordings/*.webm` off that instance, then delete the temporary instance.
3. Put the copies in a staging directory on the server, outside production storage. Then run:
   `db:recording:media-recovery-audit -- --search <dir>`.
   This gives sha256 and container validation, plus duration once ffprobe is available.
4. Only after that: prepare `RECOVERY_CANARY_001` for exactly one file.
