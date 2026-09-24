# Foundation Closeout

**Status:** READY FOR PHASE 5 (core migration)  
**Authority:** `docs/product/FINAL-SYSTEM-SPEC.md`  
**This document does not start Phase 5.**

---

## 1. What foundation includes

- Target domain tables: Purchase, Payment (extended), Enrollment, Refund, LiveSession, Recording, AttendanceInterval, CourseReviewEvent, AuditLog, Incident, SecurityEvent
- Checkout V2 service + API + unit tests (flag default **OFF**)
- Enrollment access evaluator + mode infrastructure (`off|shadow|dual|enrollment`)
- Browser E2E smoke suite (roles + Checkout V2 coverage)
- Staging isolation (separate DB, port, AUTH secret, PM2 process)
- Migration history that reproduces required foundation + transition compatibility objects from Git

## 2. Migration chain status

Committed chronological chain:

1. `20260324120000_init`
2. `20260909100000_lms_pivot`
3. `20260914120000_lesson_plan_fields`
4. `20260916100000_password_reset_tokens`
5. `20260918120000_lesson_lobby`
6. `20260923170000_phase1_target_foundation`
7. `20260924100000_phase23a_payment_currency_open_enrollment_unique`
8. `20260924110000_align_legacy_runtime_schema` — `entitlements`, `users.last_login_at`, `lessons.recording_url`
9. `20260924120000_align_lesson_assets` — `lesson_assets` (runtime teacher materials)

Provider lock: PostgreSQL (`migration_lock.toml`).

## 3. Fresh DB validation

Disposable database `lexify_foundation_fresh` on the staging host (not production, not staging app data):

- `prisma migrate deploy` applied **all** committed migrations successfully
- Verified present: entitlements, last_login_at, recording_url, payments.currency, purchases, enrollments, refunds, live_sessions, recordings, attendance_intervals, course_review_events, audit_logs, incidents, security_events
- Verified indexes: `enrollments_one_open_per_user_course`, `enrollments_user_course_active_unique`, payment/purchase idempotency (+ external txn)
- Disposable DB **dropped** after verification

## 4. Staging validation

| Check | Result |
|---|---|
| DB | `tdyulive_staging` (≠ production `tdyulive`) |
| Port | 3101 (prod 3100) |
| PM2 | `tdyu-live-staging` online; prod `tdyu-live` untouched |
| AUTH secret | Different from production |
| `prisma migrate status` | Up to date with applied chain |
| Flags (approved foundation) | `FF_COURSE_CHECKOUT_V2=false`, `FF_ENROLLMENT_ACCESS_MODE=shadow` |

## 5. Target schema validation

Conceptual chain supported in schema + DB:

`USER → COURSE → PURCHASE → PAYMENT → ENROLLMENT → (lesson access evaluator)`

Supports multi-course seats, open-enrollment uniqueness, UZS currency, refund model, completed+accessOpen permanent replay. Enrollment is **not** forced authoritative on staging for this closeout (shadow).

## 6. Checkout V2 validation

- Committed under `src/lib/checkout-v2`, `src/app/api/checkout/v2`
- Demo/idempotent/transactional; no Entitlement/Subscription writes
- `npm run test:checkout-v2` → **45/45 PASS**
- Flag default / staging: **false**

## 7. Access shadow validation

- Mode parser + evaluator tests via `npm run test:access`
- Result: **29/29 PASS** (includes enrollment-access + access-mode suites)
- Staging restored to **shadow** for foundation gate (code supports enrollment mode for later cutover)

## 8. E2E regression

Existing suite only (no new E2E phase). See closeout report for latest run counts.

## 9. Production safety

- Production app/DB/env/flags **not** modified during closeout
- Prod PM2 pid/uptime stable; Checkout V2 / enrollment flags unset (defaults safe)

## 10. Remaining intentional legacy components

Keep until later core migration waves:

- Tariff / Entitlement / Subscription V1 commerce paths
- `lessons.recording_url` as active VOD path (`recordings` table exists, not yet runtime SoT)
- TeacherPicker / onboard enroll (flags default allow)
- Dual enrollment unique indexes (active-only + open+active/completed)

## 11. Exact starting point for Phase 5

Begin **core migration** only after reading this file + FINAL-SYSTEM-SPEC. Suggested first Phase 5 concerns (not done here):

1. Decide Enrollment authoritative cutover policy on staging (currently shadow for foundation)
2. Student catalog / My Courses target UX (no Tarif)
3. Access SoT cutover with rollback plan
4. Do **not** delete legacy tables until dual-read proven

**Do not** treat recording/live redesign as foundation — those are later phases.
