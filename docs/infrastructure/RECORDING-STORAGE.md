# Recording storage (Phase 8.1)

Status: code delivered, **production root not yet provisioned** (no deploy in Phase 8.1).

## Why

Before 8.1, uploads went to `public/uploads/recordings/` inside the release directory
`/var/www/tdyu-live`. Every deploy replaced that tree; the directory mtime on production is
2026-09-18 and **all 6 referenced files are gone**. Recordings must live outside the release.

## Contract

| Item | Value |
|------|-------|
| Env | `RECORDING_STORAGE_ROOT` (absolute path) |
| Production (`NODE_ENV=production`) | **Required.** Unset → upload returns `503 RECORDING_STORAGE_NOT_CONFIGURED` + incident "Recording storage unavailable". No fallback to `public/`. |
| Rejected roots | relative paths; anything under `<cwd>/public`; in production anything under the release dir |
| Dev fallback | `<cwd>/.data/recordings-store` (never `public/`) |
| Key layout | `recordings/<courseId>/<lessonId>/source-<epochMs13>.<webm\|mp4>` |
| Sidecar | `<file>.json`: sha256, size, container, ids, uploadedAt/recoveredAt, origin (`live` \| `legacy_recovery`) |
| Stored in DB | the key only (`Lesson.recordingUrl`, `Recording.storageKey`); never an absolute path |
| Legacy keys | `/uploads/recordings/<stem>.webm` still readable (stem must contain the lesson id) |

Code: `src/lib/recording-storage.ts`.

### Path safety

- Keys are parsed by a strict regex (UUIDs, 13-digit timestamp, webm/mp4). `..`, `\0`, absolute
  paths, URLs and >300 chars are rejected before any filesystem call.
- Resolved paths must stay under the root (`STORAGE_PATH_ESCAPE` otherwise).
- A key is only served / accepted for a lesson when bound to it (`isStorageKeyForLesson`:
  durable → lesson **and** course ids match; legacy → file stem contains the lesson id).
- `/end` and `recording/publish` (`simulate_ready`) reject client-supplied keys not bound to the lesson.

### Upload security (`POST /api/teacher/lessons/[id]/recording`)

- Owning teacher only; 1 000 B – 120 MB.
- Container sniffed from magic bytes (WebM `1A45DFA3`, MP4 `ftyp`); client filename/MIME ignored.
- Written with `wx` (never overwrites); mode 0640, dirs 0750.
- sha256 computed on the received bytes and stored in the sidecar.
- Playback only via `GET /api/media/recording/[id]` (session + enrollment/teacher/admin check).

## Proposed production provisioning (NOT executed)

```bash
sudo install -d -o ubuntu -g ubuntu -m 0750 /var/lib/tdyu-live/recordings
# /var/www/tdyu-live/.env
RECORDING_STORAGE_ROOT=/var/lib/tdyu-live/recordings
```

- Owner `ubuntu` (PM2 user). `www-data` (nginx) must **not** be able to read it; it is not under any nginx `root`.
- Disk: 23 GB free of 38 GB at discovery. A 60-minute recording ≈ 100–120 MB.
- Needs a PM2 reload with `--update-env`; do it with the deploy that ships this code.

## Backup policy (proposed)

- Nightly `rsync -a --checksum /var/lib/tdyu-live/recordings/ <offsite>` (or Lightsail disk snapshot).
- Mux holds the signed VOD copy after ingest, but the source file is kept: **no automatic deletion**
  of source media, Mux assets or playback IDs anywhere in the code.
- Restore test: pick one key, re-hash against its sidecar sha256.

## Security findings at discovery (not fixed in 8.1)

1. **nginx `location /uploads/lessons/ { root /var/www/tdyu-live/public; }`** serves lesson
   uploads directly, bypassing the gated route. Recommendation: remove the block (or `internal;`)
   after confirming the app route serves those assets. No nginx change was made.
2. **Production returns 404, not 403, for `/uploads/recordings/*`.** The deployed build predates
   the middleware block; staging returns 403. Next deploy restores the 403. The directory is
   empty, so nothing is exposed today.
