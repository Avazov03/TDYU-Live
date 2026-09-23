# Lexify — Target Domain Model

**Authority:** `docs/product/FINAL-SYSTEM-SPEC.md`
**CURRENT equivalents:** see Migration Plan. Do not treat Prisma today as TARGET.

---

## 1. Mental model

```
User
 ├── TeacherProfile? (instructor)
 ├── Purchases[] → Payments[] / Refunds[]
 ├── Enrollments[] → Course
 └── (no Entitlement, no Tariff as access)

Course
 ├── instructor (TeacherProfile)
 ├── createdBy / approvedBy / publishedBy (User ids)
 ├── CoursePrice (current list price)
 ├── CourseSchedule / Lessons[]
 ├── Reviews / status machine
 └── Materials[]

Lesson
 ├── status machine (pedagogic + recording publish states)
 ├── LiveSession? (operational unit for live/pause/timers)
 ├── Recording?
 ├── AttendanceIntervals[]
 └── ChatMessages[]
```

---

## 2. Core entities

### 2.1 User
- Identity, role (`student` | `teacher` | `admin`), credentials, Telegram link.
- **AccountEligibility** (separate from live security):
  - `purchaseAllowed` (false when account restricted — blocks **new** purchases).
  - Existing enrollments not auto-destroyed by restriction.
- **LiveSecurityState** (separate): may deny join/live/recording when policy requires (session bans, risk, etc.).
- Do **not** overload a single `isBlocked` for all three semantics.

### 2.2 TeacherProfile
- Linked User (optional until invite accepted).
- Specialty/topic (faculty/subject or successor taxonomy).
- Owns Courses as **instructor**.

### 2.3 Course
**Statuses (target):**
`DRAFT → SUBMITTED → IN_REVIEW → CHANGES_REQUESTED | REJECTED | APPROVED → PUBLISHED → UPCOMING → ACTIVE → COMPLETED → ARCHIVED`
Also: `CANCELLED`, `UNPUBLISHED` (with reason).

**Fields (logical):** title, topic, short/full description, learning outcomes, instructorId, createdByUserId, approvedBy?, publishedBy?, listPrice, currency, capacity (null = unlimited), startDateApprox, timezone (`Asia/Tashkent` V1), schedule summary, cover, materials plan.

**Rules:** Teacher cannot set final price. Optional capacity closes sales when full.

### 2.4 CourseReview
- Submission events, reviewer, decision (`APPROVE_PUBLISH` | `REQUEST_CHANGES` | `REJECT`), reason, timestamps.
- Audit of price set at publish.

### 2.5 Lesson
**Statuses:**
`SCHEDULED → WAITING_ROOM → LIVE → ENDED → RECORDING_PROCESSING → RECORDING_READY → TEACHER_REVIEW → PUBLISHED`
Live pause is preferably **LiveSession.state = PAUSED** while Lesson remains LIVE (avoid “paused = ended”).
Also: `CANCELLED`.
Flag: `isAdditional` (`Qo‘shimcha dars`).

**Fields:** courseId, title, topic/description, scheduledStart, scheduledEnd (or durationMinutes), timezone, orderIndex.

### 2.6 LiveSession
Operational unit for one live attempt of a Lesson.
- States: `CREATED → WAITING → LIVE ↔ PAUSED → ENDED | ABANDONED`
- Authoritative timers: `activeTeachingSeconds`, `pauseSeconds`, `sessionStartedAt`, warnings fired flags.
- Room/signaling id, moderation flags, one-active-session enforcement metadata.

### 2.7 Recording
- Linked to Lesson (+ LiveSession).
- States: `NOT_STARTED → PROCESSING → READY → TEACHER_REVIEW → PUBLISHED | FAILED | HIDDEN`
- `readyAt`, `reviewDeadlineAt` (readyAt + 24h), `publishedAt`, `autoPublished`, edit/trim history, storage key (never public anonymous URL).

### 2.8 Purchase
- userId, courseId, amountPaid (snapshot), currency, status: `PENDING → COMPLETED | FAILED | REFUNDED | PARTIALLY_REFUNDED`
- Idempotency key / provider reference.
- Links to Payment(s).

### 2.9 Payment
- purchaseId, provider (`demo` | `payme` | `click` later), amount, status: `PENDING → PAID | FAILED | CANCELLED`
- External transaction id (unique when present).
- V1 demo may complete immediately but must still create Purchase + Enrollment with target semantics.
- Demo rows must be **flagged** and excluded from real revenue KPIs.

### 2.10 Refund
- purchaseId, requestedBy, decidedBy, reason, type (`FULL_100` | `HALF_50` | `COURSE_CANCEL_100`), status: `REQUESTED → APPROVED → PROCESSING → REFUNDED | FAILED | REJECTED`
- On REFUNDED: Enrollment access closed immediately (live/recording/materials).

### 2.11 Enrollment
- userId, courseId, purchaseId, status: `ACTIVE → COMPLETED | CANCELLED | REFUNDED`
- `accessOpen` derived: ACTIVE/COMPLETED allow permanent materials/recordings; REFUNDED/CANCELLED deny.
- Unique `(userId, courseId)` for active ownership (re-purchase after refund allowed → new purchase/enrollment history).
- **Never** expire sibling enrollments.

### 2.12 Material
- courseId / lessonId, type, storage key, visibility, version/audit on replace/hide.

### 2.13 AttendanceInterval
- userId, lessonId, liveSessionId, joinedAt, leftAt?, source (`live`), exclude waiting-room-only.

### 2.14 Progress (derived or light table)
- Lessons “done” for Student UI progress ≠ recording readiness alone.
- Course completion lifecycle is Teacher/Admin-driven after planned lessons finished; Student progress counter separate.

### 2.15 Assignment / Submission / Certificate
- Keep; Certificate = Teacher manual upload + issue record; eligibility advisory from attendance/activity, not auto gate for course completion.
- Student cannot view another student’s certificate.

### 2.16 Notification / NotificationDelivery
- Types for all mandatory events; idempotency key per (user, type, relatedId, window).
- Channels: site (required), Telegram (optional).

### 2.17 AuditLog / SecurityEvent / Incident
- Privileged/destructive actions; risk signals; system health incidents (INFO…CRITICAL).

### 2.18 AdminAction / SystemHealthSnapshot
- Action Required queue; health metrics snapshots.

---

## 3. Access source of truth

```
Enrollment.accessOpen
  + account eligibility (purchases)
  + live/security gate (join)
  + lesson/recording state
  + short-lived join token (live only)
```

**Not** Subscription.tier / Entitlement / endsAt+30d.

---

## 4. CURRENT equivalent map

| Target | CURRENT | Action |
|--------|---------|--------|
| Enrollment | `Subscription` | Replace semantics |
| Purchase | — | Add |
| Payment | `Payment` (demo_paid) | Modify |
| Refund | — | Add |
| Course.status | `isPublished` bool | Replace |
| Course.listPrice | `priceT1/T2/T3` | Replace |
| Lesson WAITING_ROOM | `lobby` | Rename/migrate |
| LiveSession | in-memory `__tdyuLiveRooms` | Add + shared store |
| Recording SM | URL/Mux fields | Add entity/states |
| Entitlement / TariffTier | models/enums | Legacy remove |
| Attendance | single `joinedAt` page-open | Replace with intervals |

---

## 5. Invariants

1. No enrollment without successful purchase (except explicit Admin manual grant with audit).
2. Multi-course: enrollments independent.
3. LINK ≠ ACCESS.
4. Pause excluded from 60m teaching timer.
5. Published recording permanent for enrolled (non-refunded) students.
6. Refund closes access immediately.
7. Demo revenue ≠ real revenue.
8. Account restriction ≠ auto wipe of ownership.
9. Teacher scope = own instructor courses only.
10. Privileged actions always audited.
