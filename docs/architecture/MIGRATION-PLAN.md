# Lexify — Migration Plan

**Authority:** `docs/product/FINAL-SYSTEM-SPEC.md`
**Domain:** `docs/architecture/TARGET-DOMAIN-MODEL.md`
**Rule:** Do not delete legacy data until mapped, dual-read verified, and rollback tested.

---

## 1. Goals

1. Move commerce/access from Tariff → Entitlement → TeacherPicker → Subscription to Course → Purchase → Payment → Enrollment.
2. Preserve existing users, teachers, courses, lessons, payments history where possible.
3. Keep system operable during phased cutover (feature flags / dual-read).
4. Provide rollback per phase.

---

## 2. Phase 0 — Inventory (read-only)

Already re-verified CURRENT:

| Finding | Status |
|---------|--------|
| `getLessonAccess` uses Subscription + tier; no isBlocked | VERIFIED |
| Enroll expires other active subscriptions | VERIFIED |
| Payment always `demo_paid`; creates Entitlement ± Subscription | VERIFIED |
| Mux webhook unsigned | VERIFIED |
| Chat GET public; lesson uploads public | VERIFIED |
| Live signal requires `status === "live"` (lobby broken) | VERIFIED |
| Admin revenue includes `demo_paid` | VERIFIED |
| No Purchase/Refund/LiveSession/AuditLog tables | VERIFIED |

Export counts before any write migration: users, teachers, courses, subscriptions, entitlements, payments, lessons by status.

---

## 3. Mapping: legacy → target

### 3.1 Subscription → Enrollment + Purchase + Payment

For each `Subscription` row:

| Field | Mapping |
|-------|---------|
| userId, courseId | Enrollment.userId, courseId |
| startsAt | Enrollment.activatedAt / Purchase.completedAt approx |
| endsAt | **Do not** use as access expiry. Set Enrollment.status=`ACTIVE` if historically active OR course still relevant; else `COMPLETED` if course ended heuristics, or keep ACTIVE for permanent access policy |
| tier | Discard for access; store as `legacyTier` metadata on Purchase if needed |
| Unique (user,course) | Enrollment unique active ownership |

Create **backfill Purchase** (status COMPLETED, amount from Payment if linked by user+course+time window, else 0 + `legacyBackfill=true`) and **Payment** (`provider=demo`, `status=PAID` or `demo`, `isDemo=true`).

**Conflict:** Multiple payments per user/course — pick latest successful-looking payment; keep orphans flagged.

### 3.2 Entitlement

- No TARGET equivalent.
- Users with Entitlement but **no** Subscription: mark `legacy_needs_course_purchase`; do **not** invent enrollment.
- After cutover, stop writing Entitlement; later drop table.

### 3.3 TariffTier / priceT1–T3

- Course.listPrice = prefer `priceT2` (mid) **or** Admin-set later — **OPEN decision for backfill default**; recommend: set `listPrice = priceT2` and store old triad in JSON `legacyPrices` until Admin re-prices.
- Remove tier feature gates in access code in same release as Enrollment cutover.

### 3.4 TeacherPicker / onboard / enroll expire-others

- Disable routes after Enrollment checkout ships.
- Historical enrolls already mapped; do not re-run expire-others.

### 3.5 Lesson.status `lobby` → `WAITING_ROOM`

- Enum migrate rename; dual-accept both during deploy window.

### 3.6 Recording fields → Recording row

- For lessons with `recordingUrl` or non-demo `muxVodPlaybackId`: create Recording `PUBLISHED` (legacy assumed published).
- Demo mux ids: leave READY/FAILED appropriately (not student-playable).

### 3.7 Attendance

- Existing `joinedAt` rows → single AttendanceInterval with leftAt=null, `source=legacy_page_open`, **excluded from “live teaching attendance” analytics** or weighted separately.

### 3.8 isBlocked

- Split migration:
  - `User.purchaseAllowed = !isBlocked` initially.
  - `User.accountStatus = isBlocked ? RESTRICTED : ACTIVE`.
  - Live security defaults open unless explicit security ban table empty.
- Stop using single flag for all checks.

---

## 4. Schema migration waves

| Wave | Change | Rollback |
|------|--------|----------|
| W1 | Add new tables/enums nullable; no behavior change | Drop new tables |
| W2 | Backfill Enrollment/Purchase/Payment from Subscription | Truncate new tables; keep old |
| W3 | Dual-read access: prefer Enrollment if present else Subscription | Flag off |
| W4 | Dual-write: new checkout writes Enrollment path only | Flag off; old path remains |
| W5 | Single-read Enrollment; disable Entitlement/enroll/tariff UI | Re-enable flag |
| W6 | Lesson/LiveSession/Recording SM + shared live store | Feature flag live_v2 |
| W7 | Drop Entitlement/TariffTier columns/tables after soak | Restore from backup only |

**Never** hard-delete published recordings or payment rows in automated jobs.

---

## 5. Data risk register

| Risk | Mitigation |
|------|------------|
| Students lose multi-course access after remapping enroll-expire history | Prefer course-checkout subscriptions; document enroll-path users |
| 30d endsAt users expect renewal | Spec: permanent access for completed/active enrollments — communicate |
| Demo_paid counted as revenue | Flag `isDemo`; exclude from net revenue |
| Orphan payments without courseId | Platform-tariff legacy: no enrollment; force re-purchase of courses |
| Mid-flight lobby/live | Maintenance window or dual status accept |
| Cascade delete Faculty→Course | Soft-delete policy before any faculty delete |

---

## 6. Feature flags (recommended)

```
ff_enrollment_access
ff_course_checkout_v2
ff_disable_tariff_ui
ff_disable_onboard_enroll
ff_live_waiting_room_v2
ff_live_shared_rooms
ff_recording_review_24h
ff_refunds_v1
```

---

## 7. Rollback story (per release)

1. Toggle feature flag OFF → previous access path.
2. Keep dual-written data (do not delete).
3. If schema W1+ only additive → deploy previous app build.
4. Destructive drops only after ≥1 soak period + backup restore drill.

DB backup before each wave. Document restore command in ops runbook (not secrets).

---

## 8. Success criteria for migration complete

- [ ] No Student UI path to Tarif/Onboard/TeacherPicker
- [ ] Access uses Enrollment only
- [ ] Multi-course does not expire siblings
- [ ] No 30-day access cutoff for enrolled completed courses
- [ ] Demo excluded from real revenue
- [ ] Acceptance tests in `docs/qa/ACCEPTANCE-TESTS.md` green for commerce + access
