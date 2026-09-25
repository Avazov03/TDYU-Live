# Phase 8 / Recording Wave 1 — Lifecycle + Teacher Review + Publish

**Status:** Staging via `FF_RECORDING_REVIEW_V1=true`  
**Keeps:** Enrollment access, Checkout V2, Live Waves 1–3  
**Production untouched** — flag defaults **OFF**.

---

## 1. Existing recording architecture

| Layer | Before Wave 1 | Wave 1 |
|-------|---------------|--------|
| Live end | Sets `Lesson.ended` + optional `recordingUrl` / Mux ids; notifies “Yozuv tayyor” | Creates/updates `Recording`; no student VOD notify until publish |
| Mux webhook | Unsigned; sets lesson ended + notifies students | Signature verify; `markRecordingReady`; no student publish notify |
| Playback | `GET /api/media/recording/[lessonId]` if Enrollment | Same + **must be `Recording.status=published`** for students |
| Schema | `Recording` + `RecordingStatus` already present | **No migration** — reuse fields |

Sources preserved: browser MediaRecorder upload (`storageKey` / `recordingUrl`) and Mux VOD (`muxPlaybackId`).

---

## 2. Recording state machine

```
Live ENDED
  → Recording processing   (awaiting Mux VOD)
  → teacher_review         (READY for review; readyAt + reviewDeadlineAt)
  → published              (students may replay)
```

Also: `processing|ready|teacher_review` → `failed` (never published).

Product READY maps to DB `teacher_review` (or `ready`) — both are **not** student-visible. Publish accepted from `ready` or `teacher_review`.

---

## 3. Live end → recording

`POST /api/teacher/lessons/[id]/end` when flag on:

- Ends LiveSession + closes attendance (unchanged Waves 1–3)
- `startRecordingAfterLiveEnd`:
  - local `recordingUrl` → `teacher_review` immediately
  - real Mux live without VOD → `processing`
  - no material → lesson `ended`, no fake Recording
- Student notify: “Dars tugadi” only (not published)

---

## 4–6. Processing / READY / Teacher review

- Mux `video.asset.ready` → `markRecordingReady` (idempotent)
- `readyAt` + `reviewDeadlineAt = readyAt + 24h`
- Teacher preview via media API / learn page
- Minimal publish control: `RecordingPublishButton`

---

## 7–8. Publish / Student access

`POST /api/teacher/lessons/[id]/recording/publish` `{ action: "publish" }`

Student requires: auth + Enrollment (`getLessonAccess`) + `Recording.status=published`.

Denied for: processing / ready / teacher_review / failed.

`GET /api/recording/status?lessonId=` — availability without bytes.

---

## 9. Permanent replay

Published + open Enrollment → replay. No Subscription/`endsAt` gate for Wave 1 publish path. Refund/closed Enrollment uses existing access deny (recording row kept).

---

## 10–11. 24-hour review / Auto-publish

Clock starts at **readyAt**, not live end.

Cron: `GET /api/cron/recording-auto-publish` (`CRON_SECRET`) → `autoPublishDueRecordings`.

Sets `autoPublished=true` + AuditLog when actor present; auto path audited via `autoPublished` flag.

---

## 12. Failure

`video.asset.errored` / `failRecording` → status `failed`, lesson held/`ended`, Incident (deduped by open related recording). No auto-refund.

---

## 13–14. Webhook security / Idempotency

- `MUX_WEBHOOK_SECRET` + `Mux-Signature` HMAC (`src/lib/mux-webhook.ts`)
- Flag on without secret → 503 (except non-prod E2E fixture header)
- Map stream → lesson via `lesson.muxLiveStreamId` only
- Repeated ready events update ids; do not duplicate publish or student notify

---

## 15. Security model

| Actor | Unpublished | Published |
|-------|-------------|-----------|
| Unauthenticated | DENY | DENY |
| Enrolled student | DENY | ALLOW |
| Closed Enrollment | DENY | DENY |
| Course teacher | preview ALLOW | ALLOW |
| Other course teacher | DENY | DENY |
| Student publish | DENY | — |

---

## 16–17. Tests / E2E

- Unit: `src/lib/recording-wave1.test.ts` (`npm run test:recording`)
- E2E: `e2e/recording/wave1-recording-lifecycle.spec.ts` (`E2E_RECORDING_WAVE1=1`)
- Simulate ready: teacher `action=simulate_ready` (blocked in production unless `ALLOW_RECORDING_E2E_HOOKS=1`)

Fixture lesson: `STAGING_FIXTURE.recordingLessonId` (`…000047`). Reset to `scheduled` before re-runs.

---

## 18–19. Staging / Production

```
FF_RECORDING_REVIEW_V1=true   # staging only
# alias: FF_RECORDING_REVIEW_24H=true
```

Keep existing Live/Checkout/Enrollment flags. Production: leave unset.

---

## 20. Remaining limitations

- Mux playback policy still “public” at Mux layer — app gate is authz on lesson/media routes; signed playback tokens are a later wave
- Browser recording file must exist under `uploads/recordings/` for local playback bytes
- Auto-publish requires cron invocation
- No trim/editor/watermark

## 21. Next Recording Wave

Signed Mux playback tokens, trim/review UX, or Telegram recording notifications — pick one.
