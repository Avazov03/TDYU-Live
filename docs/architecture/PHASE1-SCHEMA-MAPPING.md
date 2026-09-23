# Phase 1 — CURRENT → TARGET Schema Mapping

**Authority:** `docs/product/FINAL-SYSTEM-SPEC.md`
**Phase 1 scope:** Additive foundation only. Legacy tables remain authoritative for runtime until later flags.

---

## 1. Migration inventory (existing)

| Migration | Purpose |
|-----------|---------|
| `20260324120000_init` | Initial |
| `20260909100000_lms_pivot` | LMS pivot |
| `20260914120000_lesson_plan_fields` | Lesson plan fields |
| `20260916100000_password_reset_tokens` | Password reset |
| `20260918120000_lesson_lobby` | `lobby` status |
| `20260923170000_phase1_target_foundation` | **NEW** additive target domain |

---

## 2. CURRENT models — Phase 1 treatment

| CURRENT | Phase 1 action | Notes |
|---------|----------------|-------|
| User | **MODIFY** additive fields | `purchaseAllowed`, `accountStatus`; keep `isBlocked` |
| Teacher | KEEP | Relations to new Course fields only |
| Course | **MODIFY** additive fields | lifecycle/price/capacity/audit ids; keep `priceT*` + `isPublished` |
| Lesson | **MODIFY** additive fields + enum values | Keep `lobby`; add target statuses; keep mux/recordingUrl |
| Payment | **MODIFY** additive fields | Keep `demo_paid` default + tier; add purchase link/idempotency/isDemo |
| Subscription | KEEP | Still access SoT until Phase 2+ |
| Entitlement | KEEP | No auto→Enrollment |
| Attendance | KEEP | New `AttendanceInterval` parallel |
| Notification | **MODIFY** enum values only | Additive notification types |
| TariffTier | KEEP | Legacy |
| LessonStatus | **MODIFY** add values | Do not remove `lobby` |
| All other models | KEEP | |

---

## 3. TARGET models — Phase 1 create

| Target model | Table | Purpose | Ownership | Lifecycle | Migration source |
|--------------|-------|---------|-----------|-----------|------------------|
| Purchase | `purchases` | Paid order snapshot | User | PENDING→COMPLETED/FAILED/REFUNDED… | Backfill later from Subscription+Payment |
| Enrollment | `enrollments` | Course seat / access SoT (future) | User+Course | ACTIVE→COMPLETED/CANCELLED/REFUNDED | Backfill from Subscription only (script, opt-in) |
| Refund | `refunds` | Money return + access close | Purchase | REQUESTED→… | Empty in Phase 1 |
| LiveSession | `live_sessions` | Ops unit for live/pause/timers | Lesson | CREATED→…→ENDED | Empty; in-memory stays until Phase 8 |
| Recording | `recordings` | VOD lifecycle | Lesson | PROCESSING→…→PUBLISHED | Optional backfill script later |
| AttendanceInterval | `attendance_intervals` | Live join/leave analytics | User+Lesson+LiveSession? | open/closed intervals | Empty; legacy Attendance untouched |
| CourseReviewEvent | `course_review_events` | Admin review audit | Course | append-only | Empty |
| AuditLog | `audit_logs` | Privileged actions | system | append-only | Empty |
| Incident | `incidents` | Ops/security incidents | system | open→resolved | Empty |
| SecurityEvent | `security_events` | Risk signals | User? | append-only | Empty |

---

## 4. Field-level: Course (additive)

| Field | Type | Null | Purpose | Source |
|-------|------|------|---------|--------|
| lifecycleStatus | CourseLifecycleStatus | yes | Target SM; null = legacy `isPublished` | null initially |
| listPrice | Int | yes | Admin list price; null = use legacy triad | null |
| capacity | Int | yes | null = unlimited | null |
| topicUz | String | yes | Topic | null |
| shortDescriptionUz | Text | yes | Card blurb | null |
| startsAtApprox | DateTime | yes | Approximate start | null |
| timezone | String | no default Asia/Tashkent | Schedule TZ | default |
| createdByUserId | String? | yes | Admin-created audit | null |
| approvedByUserId | String? | yes | Reviewer | null |
| publishedByUserId | String? | yes | Publisher | null |

**Security:** price never trusted from client; listPrice server-side later.

---

## 5. Field-level: User (additive)

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| purchaseAllowed | Boolean | true | Blocks new purchases when false |
| accountStatus | AccountStatus | active | Separate from live security |

SQL backfill: `purchaseAllowed = NOT is_blocked`, `accountStatus = CASE WHEN is_blocked THEN restricted ELSE active END`.
**Does not** change `isBlocked` or runtime auth yet.

---

## 6. Field-level: Lesson (additive)

| Field | Type | Purpose |
|-------|------|---------|
| scheduledEndAt | DateTime? | Duration/conflict |
| durationMinutes | Int? | Default 60 later |
| isAdditional | Boolean default false | Qo‘shimcha dars |
| topicUz | String? | Topic label |
| cancelledAt | DateTime? | Cancel marker |

**LessonStatus new values (keep lobby):**
`waiting_room`, `paused`, `recording_processing`, `recording_ready`, `teacher_review`, `published`, `cancelled`

Runtime continues using `scheduled|lobby|live|ended` until live phases.

---

## 7. Field-level: Payment (additive)

| Field | Type | Purpose |
|-------|------|---------|
| purchaseId | String? FK | Link to Purchase |
| idempotencyKey | String? unique | Duplicate prevention |
| externalTxnId | String? unique | Provider txn |
| isDemo | Boolean default true | Revenue exclusion |
| paidAt | DateTime? | When marked paid |

Existing rows: `is_demo = true` in migration.

---

## 8. Enrollment uniqueness

- App may have REFUNDED then new ACTIVE.
- DB: **partial unique** `(user_id, course_id) WHERE status = 'ACTIVE'`
- Prisma: `@@index([userId, courseId])` + raw SQL unique partial index

---

## 9. Conflicts / UNKNOWN (no product decision)

| Item | Note |
|------|------|
| Backfill listPrice from priceT1/T2/T3 | Phase 1 leaves null; Phase 3/4 Admin or script decide (recommend T2 later) |
| Mapping `lobby` vs `waiting_room` | Dual exist; cutover later |
| PAUSED on Lesson vs LiveSession | Both supported in schema; runtime prefers LiveSession in Phase 8 |
| NotificationType many new values | Additive; old code ignores unknown |

---

## 10. What Phase 1 will NOT do

- Delete Tariff/Entitlement/Subscription
- Change `getLessonAccess` / enroll / demo payment behavior
- Frontend rewrites
- Live room replacement
- Destructive data deletes
- Auto Enrollment from Entitlement orphans
