# Phase 8.1 — signed Mux ingest hardening

Code: `src/lib/recording-mux-ingest.ts`, `src/lib/mux.ts` (upload/asset helpers),
`src/app/api/mux/webhook/route.ts`, `scripts/recording-mux-ingest.ts`.

## Flow

```
durable file (RECORDING_STORAGE_ROOT)
  └─ start:    checks → Mux direct upload (new_asset_settings.playback_policy = ["signed"])
               ledger row written BEFORE bytes are sent → PUT file
  └─ finalize: upload → asset → decide → signed playback id (create or reuse)
               → Recording (teacher_review); webhook or CLI poll
```

Triggers:
- Live lessons: upload route runs `after(startRecordingMuxIngest)` only when `FF_RECORDING_MUX_INGEST_V1=true` (default **off**).
- Recovered legacy media: `npm run db:recording:mux-ingest -- --origin legacy_recovery --apply` (confirm envs below).
- Completion: `video.asset.ready|errored` webhook with a `lexify:rec:v1:` passthrough (signature required;
  asset state is re-read from Mux, never trusted from the payload), or the CLI's backoff poll.

## Guarantees

| Rule | Where |
|------|-------|
| Signed only; assets with any **public** playback id are blocked | `decideAssetPlayback` |
| Asset must carry our passthrough for this lesson + key | `decideAssetPlayback` |
| Blocked if Mux API creds or signing key missing (`MUX_API_CREDENTIALS_MISSING`, `MUX_SIGNING_KEY_MISSING`) | `startRecordingMuxIngest` |
| Durable key bound to lesson + course; sha256 must match expected | `startRecordingMuxIngest` |
| Idempotent: stable passthrough `lexify:rec:v1:<lessonId>:<sha256(key)[0:16]>`; AuditLog `recording.mux_ingest_started` ledger; live uploads/assets reused; only errored/cancelled/timed-out uploads restart | `decideUploadReuse`, `findLedgerUpload` |
| No duplicates: a Recording with a mux id is never re-ingested; a different mux id blocks | `canIngestRecording`, finalize |
| Result is `teacher_review`, never `published` | finalize |
| Legacy recovery: `reviewDeadlineAt = null` so the 24 h auto-publish cron cannot publish it | finalize |
| `Lesson.muxVodPlaybackId` / `recordingUrl` never touched by ingest | finalize |
| Failures: audit `recording.mux_ingest_failed` + deduped incident "Recording Mux ingest failed" (high) | `recordIngestFailure` |
| Nothing is deleted (source file, Mux asset, playback ids) | whole module |

## Authorization fixes shipped with 8.1

- `legacyStudentMayPlay`: with `FF_RECORDING_REVIEW_V1` off, students were allowed any Recording that had a
  `muxPlaybackId`, including `teacher_review`. Now `teacher_review | hidden | failed | processing` are denied.
- `/end` no longer copies `muxLivePlaybackId` into `muxVodPlaybackId`. This is the root cause of the 8
  production "VOD" ids that are really live-stream playback ids.
- Client-supplied `recordingUrl` accepted only when bound to the lesson (`/end`, `simulate_ready`).

## Confirmations

| Script | Default | Apply requires |
|--------|---------|----------------|
| `db:recording:media-recovery-audit` | read-only | — (never writes) |
| `db:recording:media-recovery` | dry-run | `--apply`, production: `CONFIRM_PRODUCTION_RECORDING_RECOVERY=true` |
| `db:recording:mux-ingest` | dry-run | `--apply` + `CONFIRM_REAL_MUX_INGEST=true`, production: `CONFIRM_PRODUCTION_RECORDING_INGEST=true` |
| `db:recording:production-canary` | — | `CONFIRM_PRODUCTION_RECORDING_CANARY=true`; stops on first failed precondition |

Canary preconditions: production DB, Mux API creds, **signing key**, writable persistent root, app health,
lesson exists, durable key bound to lesson, file present, sha256 = sidecar, no existing Recording.
Post-checks: exactly one Recording, `teacher_review`, no deadline, lesson columns untouched, policy signed,
CDN 403 without token / 200 with token / 403 expired, client playbackId rejected, optional
enrolled/unenrolled/other-teacher denials, health unchanged. Then **checkpoint**: no batch without approval.

## Signing key (operator action, not done by the agent)

Create in the Mux dashboard (Settings → Signing Keys) and put on the server only:
`MUX_SIGNING_KEY_ID`, `MUX_SIGNING_PRIVATE_KEY` (base64 PEM) in `/var/www/tdyu-live/.env`.
Never in git, never generated in the repository, fixture signing never used in production.
