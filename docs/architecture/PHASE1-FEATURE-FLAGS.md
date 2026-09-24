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
| `FF_RECORDING_REVIEW_24H` | `recordingReview24h` | `false` | Teacher review window + auto-publish | Phase 9 | false → legacy URL/Mux only |
| `FF_REFUNDS_V1` | `refundsV1` | `false` | Refund request/decide APIs | Phase 10 | false → no refund APIs |

**Phase 1:** flags module only; **no call sites** change access/payment/live yet (except optional import-safe readiness).

Add to `.env.example` as documentation; do not enable in production until phase gates pass.
