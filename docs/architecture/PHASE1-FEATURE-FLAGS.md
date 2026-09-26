# Phase 1 — Feature / compatibility flags

All defaults **false** (or safe) so CURRENT runtime is unchanged.

| Flag env | Code key | Default | Controls | When to enable | Rollback |
|----------|----------|---------|----------|----------------|----------|
| `FF_ENROLLMENT_ACCESS_MODE` | `getEnrollmentAccessMode()` | `off` | `off` = legacy only; `shadow` = serve legacy + compare Enrollment (log MATCH/MISMATCH); `dual` = Enrollment when present else legacy fallback; `enrollment` = Enrollment sole SoT (Phase 2.6 cutover) | shadow after fixture/dry-run PASS; dual after shadow soak; enrollment on staging after dual PASS | Set `off` or prior mode |
| `FF_ENROLLMENT_ACCESS` | `enrollmentAccess` (compat) | unset/`false` → off | Boolean/compat: `shadow` → shadow; `true`/`dual` → dual; `enrollment` → enrollment | Prefer `FF_ENROLLMENT_ACCESS_MODE` | unset / false |

### Permanent replay (later recording phase)

NEW Enrollment evaluator **must not** deny via `Subscription.endsAt`. Seat uses `accessOpen` + status `active|completed`. Recording phase inherits this.
| `FF_COURSE_CHECKOUT_V2` | `courseCheckoutV2` | `false` | New checkout writes Purchase+Payment+Enrollment | Phase 3 after schema soak | false → legacy `/api/payments/demo` |
| `FF_DISABLE_TARIFF_UI` | `disableTariffUi` | `false` | Hide Student Tarif/landing triad CTAs | After catalog ships | false → show Tarif again |
| `FF_DISABLE_ONBOARD_ENROLL` | `disableOnboardEnroll` | `false` | Disable `/onboard` + `POST /api/enroll` | After course checkout is sole path | false → restore onboard |
| `FF_LIVE_WAITING_ROOM_V2` | `liveWaitingRoomV2` | `false` | Waiting room join + target live SM | Phase 7–8 | false → current liveGate |
| `FF_LIVE_SHARED_ROOMS` | `liveSharedRooms` | `false` | Shared room state vs process memory | Multi-instance ready | false → in-memory Map |
| `FF_LIVE_MUX_PLAYBACK_V1` | `isLiveMuxPlaybackV1Enabled()` | `false` | Mux live player on `/learn` + `/shorts` for enrolled viewers, opt-in WebRTC room; effective only with `FF_ENROLLMENT_ACCESS_MODE=enrollment` (see `PHASE8.5-LIVE-MUX-PLAYBACK.md`) | Phase 8.5 after staging browser QA | false → WebRTC-only live room |
| `FF_RECORDING_REVIEW_24H` | `recordingReview24h` | `false` | Teacher review window + auto-publish | Phase 9 | false → legacy URL/Mux only |
| `FF_REFUNDS_V1` | `isRefundsV1Enabled()` / `refundsV1` | `false` | Demo refund record, no money movement. Teacher «Kursni bekor qilish» before the course starts (nothing taught): course → `cancelled`, open lessons cancelled, every completed Purchase → Refund `course_cancel_100` (100%), Purchase `refunded`, seats closed, students notified. After start: no student self-refund; admin `/admin/payments` «50% qaytarish» only while progress (taught / planned lessons) < 50% with a written reason → Refund `half_50`, Purchase `partially_refunded`, seat closed. Payment rows untouched. Audit `course.cancel`, `refund.*` | After staging browser QA | false → no refund APIs |
| `FF_COURSE_REVIEW_V1` | `isCourseReviewV1Enabled()` | `false` | Teacher courses start as `draft`; submit → admin review («Tekshiruv» on `/admin/courses`) → approve with `listPrice` → publish (`upcoming`/`published`). Live start/lobby blocked until published; first live start sets `active`. Legacy (`lifecycleStatus` null) courses unchanged | Phase 4 after staging browser QA | false → teacher courses publish immediately |
| `FF_SCHEDULE_RULES_V1` | `isScheduleRulesV1Enabled()` | `false` | Lesson/course-plan create: no past time, no overlap with the Teacher's other lessons (default 90 min). Reschedule/delete only if the lesson is ≥24h away and the new time is ≥24h away; students notified + audit `lesson.rescheduled`. Lobby/start blocked while another lesson is live/lobby or would overlap an upcoming one (early start allowed otherwise) | After staging browser QA | false → times unchecked (legacy) |
| `FF_COURSE_COMPLETION_V1` | `isCourseCompletionV1Enabled()` | `false` | Teacher «Kursni yakunlash» on an `active` course once no lesson is scheduled/lobby/live: course → `completed`, open Enrollments → `completed` (accessOpen stays true — permanent replay), audit `course.complete`, students notified. New lessons on a completed course → 409. Attendance is not an input | After staging browser QA | false → courses never complete (legacy) |

**Phase 1:** flags module only; **no call sites** change access/payment/live yet (except optional import-safe readiness).

Add to `.env.example` as documentation; do not enable in production until phase gates pass.
