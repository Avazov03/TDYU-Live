# Lexify — Implementation Order

**Authority:** `docs/product/FINAL-SYSTEM-SPEC.md` §19
**Do not** randomly refactor unrelated UI/libraries mid-migration.

---

## Gate 0 — Spec freeze (this folder)

- [x] `docs/product/FINAL-SYSTEM-SPEC.md`
- [x] `docs/architecture/TARGET-DOMAIN-MODEL.md`
- [x] `docs/architecture/MIGRATION-PLAN.md`
- [x] `docs/architecture/API-PLAN.md`
- [x] `docs/security/SECURITY-MODEL.md`
- [x] `docs/qa/ACCEPTANCE-TESTS.md`
- [x] `docs/implementation/IMPLEMENTATION-ORDER.md`

**Stop condition before code:** Product owner confirms freeze (or delta patch to Final Spec).

---

## Phase 1 — Schema foundation (additive)

**Deliverables:** Prisma models for Purchase, Payment (extended), Enrollment, Refund, Course status/price fields, Lesson status extensions, LiveSession, Recording, AttendanceInterval, AuditLog, Incident, Notification type expansions; feature flags module.

**Tests:** Migration applies clean on empty + copy of prod-like dump.
**Rollback:** Drop additive tables / reverse migration.

**Files (expected):** `prisma/schema.prisma`, new migration, `src/lib/flags.ts` (or env flags).

---

## Phase 2 — Backfill + dual-read access

**Deliverables:** Map Subscription → Enrollment (+ Purchase/Payment backfill); `getLessonAccess` dual-read behind `ff_enrollment_access`.

**Tests:** AT-PAY-07 style fixtures; access parity for remapped users.
**Rollback:** Flag OFF.

**Files:** `src/lib/access.ts`, migration scripts under `scripts/`.

---

## Phase 3 — Commerce cutover (demo OK)

**Deliverables:** Course checkout → Payment → Purchase → Enrollment; idempotency; disable entitlement writes on new path; Admin revenue excludes demo.

**Tests:** AT-PAY-01…08.
**Rollback:** Flag `ff_course_checkout_v2` OFF; keep legacy demo route read-only.

**Files:** `src/app/api/payments/**`, `src/app/checkout/**`, `CheckoutClient.tsx`, `admin-stats.ts`.

---

## Phase 4 — Course review / price / publish

**Deliverables:** Teacher draft/submit; Admin review queue; atomic approve+price+publish; capacity; createdBy≠instructor.

**Tests:** AT-CRS-01…06.
**Files:** teacher/admin course APIs + Admin UI review.

---

## Phase 5 — Student catalog / My Courses

**Deliverables:** Catalog of published courses; remove Student-facing Tarif/Onboard/TeacherPicker (flag); My Courses Upcoming/Active/History; permanent access for completed.

**Tests:** Multi-course + history replay smoke.
**Files:** `page.tsx`, `courses/[id]`, `my-courses`, `onboard` disable, Sidebar/nav copy.

---

## Phase 6 — Schedule conflict engine

**Deliverables:** BE overlap checks on create/reschedule/publish; ≥24h rule; early start if no conflict.

**Tests:** AT-CRS-03…04.
**Files:** lesson create/patch, admin publish.

---

## Phase 7 — Live security + join token

**Deliverables:** `/join` token; signal validates token; chat/media enrollment-gated; fix public routes.

**Tests:** AT-SEC-01…07, AT-SEC-09.
**Files:** `live/signal`, chat, uploads, media, mux webhook signature.

---

## Phase 8 — Waiting room / pause / 60m / shared state

**Deliverables:** Waiting room presence without teaching media; pause excludes timer; 55/58/59 warnings; auto-end 60m; shared room store (Redis or equiv); preserve MeetRoom UX.

**Tests:** AT-LIVE-01…12.
**Files:** `live-rooms.ts`, LiveStudio, MeetRoom, lesson lobby/start/end/pause routes, Redis wiring.

---

## Phase 9 — Recording lifecycle + 24h auto-publish

**Deliverables:** PROCESSING → READY → TEACHER_REVIEW → PUBLISHED; edit/preview/publish confirm; cron auto-publish; failure → Incident.

**Tests:** AT-REC-01…06.
**Files:** recording APIs, teacher review UI, cron, mux webhook idempotency.

---

## Phase 10 — Refunds / cancellation / teacher replacement

**Deliverables:** Policy engine; access revoke; course cancel 100%; replacement with conflict filter.

**Tests:** AT-REF-*, AT-CRS-09.

---

## Phase 11 — Notifications / Telegram

**Deliverables:** Full event matrix; site mandatory; Telegram optional; idempotent sends.

**Tests:** AT-NTF-*.

---

## Phase 12 — Admin Action Required / Incidents / System Health

**Deliverables:** Dashboards without secrets; safe self-heal hooks; Critical path.

**Tests:** AT-OPS-*.

---

## Phase 13 — Certificates / assignments harden

**Deliverables:** Enrollment checks; student-only cert view; optional assignments unchanged for completion rules.

---

## Phase 14 — Legacy removal soak

**Deliverables:** Remove Tariff UI, Entitlement writes, enroll expire-others, Subscription access, public media, process-local-only rooms, old progress labels; rename ot-/opentsul where safe.

**Tests:** Full acceptance pack.
**Rollback:** Only via backup; no casual DROP in prod without soak sign-off.

---

## Phase 15 — Full E2E / security regression

Run `docs/qa/ACCEPTANCE-TESTS.md` end-to-end on staging (`lexify.zonic.fit` staging or local).
No production deploy until owner approval.
No auto commit/push/deploy by agent unless user says «qil».

---

## Parallelism (safe)

- Docs/flags scaffolding: Phase 1
- Admin review UI can start after Phase 1 types exist
- Live shared store spike can prototype in parallel but **must not** merge behind students until Phase 7–8

## Forbidden during migration

- Blind `DROP TABLE` of payments/subscriptions without backfill
- Rewriting Live Room visuals “for beauty” (preserve UX)
- Reintroducing T1/T2/T3 access gates
- Counting demo as revenue
- Auto-deleting published recordings as “cleanup”
