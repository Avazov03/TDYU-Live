# Final pre-production verification

Local `main` (unpushed, ahead of `manba/main`) verified on the staging QA build (`tdyulive_staging`,
port 3101). Production was not touched: it runs `52b9afa` from `hotfix/recording-runtime-8.3`, unchanged.

The hotfix branch is not in `main`'s history, but its runtime content is: `recording-storage.ts` and the
recording routes are identical on `main`; `completeLiveStream` was removed on purpose in `95fce6a`. The only
hotfix-only file, `src/lib/recording-storage.test.ts`, is restored on `main` and runs in `test:recording`.

## Feature flags

`envFlag` default is **off** for every flag below. Production `.env` sets no `FF_*` at all, so everything
runs on defaults. Nothing was enabled in production.

| Flag | Default | Staging QA | Production now |
| --- | --- | --- | --- |
| `FF_COURSE_CHECKOUT_V2` | off | on | off |
| `FF_DISABLE_TARIFF_UI` | off | off | off |
| `FF_DISABLE_ONBOARD_ENROLL` | off | off | off |
| `FF_ENROLLMENT_ACCESS_MODE` | off | enrollment | off |
| `FF_COURSE_REVIEW_V1` | off | on | off |
| `FF_SCHEDULE_RULES_V1` | off | on | off |
| `FF_COURSE_COMPLETION_V1` | off | on | off |
| `FF_REFUNDS_V1` | off | on | off |
| `FF_LIVE_WAITING_ROOM_V2` | off | on | off |
| `FF_LIVE_AV_POLICY_V2` | off | on | off |
| `FF_LIVE_ATTENDANCE_V3` | off | on | off |
| `FF_LIVE_SHARED_ROOMS` | off | off | off |
| `FF_LIVE_MUX_PLAYBACK_V1` | off | **off** | off |
| `FF_RECORDING_REVIEW_V1` | off | on | off |
| `FF_RECORDING_REVIEW_24H` | off | off | off |
| `FF_RECORDING_SIGNED_PLAYBACK_V1` | off | on | off |
| `FF_RECORDING_LEGACY_MIGRATION_V1` | off | on | off |
| `FF_RECORDING_MUX_INGEST_V1` | off | off | off |

`FF_LIVE_MUX_PLAYBACK_V1` stays off everywhere: it needs a real Mux live stream plus a signing key, and
neither was available for verification (`REAL_MUX_VERIFICATION = NOT_AVAILABLE`). Live teaching runs on
WebRTC; student hide/show of the Mux player only exists in that path and is not applicable with the flag off.

## Mux

- No stream was created or deleted; the 8 legacy production streams were not touched.
- `MUX_SIGNING_KEY_ID` / `MUX_SIGNING_PRIVATE_KEY` are missing on staging and production. Signed Mux
  playback is therefore **not verified**; with a real Mux id and no key the API returns
  `503 SIGNING_NOT_CONFIGURED` (no public fallback).
- Production prerequisite before enabling Mux playback: operator creates the signing key and adds it to the
  server `.env` only — see `docs/architecture/PHASE8.2-MUX-SIGNING-READINESS.md`.

## Database (staging, read-only checks after the final run)

| Check | Result |
| --- | --- |
| Duplicate open enrollments per user/course | 0 |
| Open attendance intervals / open live sessions | 0 / 0 |
| Lessons in lobby / waiting / live / paused | 0 |
| Interval `left_at < joined_at` | 0 |
| Recording impossible states (published without timestamp or media, ready without timestamp) | 0 |
| More than one published recording per lesson | 0 |
| Refund decided without timestamp / over-refund / refunded seat still open | 0 / 0 / 0 |
| Notifications pointing at missing courses | 0 |
| Completed purchases whose seat is closed | 3 — pre-existing (2026-09-24) Phase 5 checkout fixture: seats were cancelled by raw SQL in a staging re-run script, not by the app. Same user/course has exactly one open seat. |

Journey course trail: review events `submitted → changes_requested → submitted → approve_publish (120000)`,
lifecycle `completed`, one completed purchase + demo payment, enrollment `completed` with access open,
lesson `published`, live session `ended`, 2 attendance intervals (leave + rejoin), 0 open, recording
`published` with file, chat message stored.

## Security

- Client bundle and app log contain none of the secret env values; no secret identifiers in `.next/static`.
- Stream keys are only read through owner-scoped queries (`course.teacherId`); staging holds demo keys only.
- Student → every teacher/admin API: 403 (405 for GET on POST-only routes). Teacher → admin APIs: 403.
- Guessed recording id / lesson id: 404.
- Fixed here: `/api/media/recording/:id` and `/api/recording/playback-token` (lessonId) answered 404
  `NO_RECORDING` to non-enrolled users before checking access, revealing whether a lesson had a recording.
  Access is now checked first (403); covered in `e2e/recording/wave2-signed-playback.spec.ts`.

## Lint

`eslint .` reports 16 errors, all pre-existing in `3dd1aa7` (blame-verified); 0 introduced by this branch.

## Known pre-existing issues (not changed)

- `TeacherGroupBoard`, `AdminTeachersManager`, `AdminUsersManager` format dates with
  `Intl.DateTimeFormat("uz-UZ", { month: "short" })` in client components. Node renders `06-okt`,
  Chromium renders `M10 06`, which causes a React hydration warning on those pages. Same fix as
  `AdminCoursesBoard` (`tashkentParts` + `UZ_MONTHS_SHORT`).
- `formatSom` had the same problem for every price (`2 840 000` vs `2,840,000`); fixed here.
