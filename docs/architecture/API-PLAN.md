# Lexify — API Plan (Target)

**Authority:** `docs/product/FINAL-SYSTEM-SPEC.md`
**Note:** Paths are target contracts. Existing routes may remain temporarily behind flags.

---

## 1. Principles

- Server is source of truth for price, enrollment, lesson state, timers.
- All mutating commerce/live endpoints: authN + authZ + idempotency where applicable.
- Never trust client amounts, status transitions, or “hidden UI”.
- LINK ≠ ACCESS: live join returns short-lived token after checks.

---

## 2. Commerce

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/catalog/courses` | public | Published courses list |
| GET | `/api/catalog/courses/:id` | public | Course detail |
| POST | `/api/checkout/sessions` | student | Create checkout for courseId; server loads listPrice; returns sessionId; **Idempotency-Key** |
| POST | `/api/payments/demo/confirm` | student | V1 demo pay: mark PAID → create Purchase+Enrollment in transaction |
| GET | `/api/me/purchases` | student | Own purchases |
| GET | `/api/me/enrollments` | student | Own enrollments / My Courses |
| POST | `/api/refunds` | student | Pre-start 100% request only |
| POST | `/api/admin/refunds/:id/decide` | admin | Approve/reject; 50% rule enforcement |
| POST | `/api/admin/courses/:id/cancel` | admin | Course cancel → 100% refunds + notify |

**Replace / deprecate:** `POST /api/payments/demo` (legacy entitlement), `POST /api/enroll`.

**Idempotency:** same Idempotency-Key or provider txn → same Purchase/Enrollment; no duplicates.

---

## 3. Course review / teacher / admin

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/teacher/courses` | teacher | Create DRAFT |
| PATCH | `/api/teacher/courses/:id` | teacher owner | Edit while DRAFT / CHANGES_REQUESTED |
| POST | `/api/teacher/courses/:id/submit` | teacher | → SUBMITTED |
| POST | `/api/teacher/courses/:id/finish` | teacher | Complete course if planned lessons done |
| POST | `/api/teacher/courses/:id/lessons` | teacher | Add lesson / additional lesson |
| POST | `/api/admin/courses` | admin | Create on behalf of teacher |
| GET | `/api/admin/reviews` | admin | Review queue |
| POST | `/api/admin/reviews/:courseId/decide` | admin | changes/reject/approve+price+publish (atomic) |
| PATCH | `/api/admin/courses/:id/price` | admin | Price change + audit |
| POST | `/api/admin/courses/:id/unpublish` | admin | Reason + impact |
| POST | `/api/admin/courses/:id/replace-teacher` | admin | Conflict-checked replacement |

---

## 4. Schedule

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/teacher/lessons/:id/reschedule` | teacher | ≥24h rule + conflict BE |
| GET | `/api/schedule/conflicts` | teacher/admin | Preview overlap |

**Conflict rule:** `existingStart < newEnd AND newStart < existingEnd` for same instructor.

---

## 5. Live / waiting room

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/lessons/:id/waiting-room/open` | instructor | SCHEDULED → WAITING_ROOM |
| POST | `/api/lessons/:id/start` | instructor | → LIVE; notify enrolled; create/start LiveSession timers |
| POST | `/api/lessons/:id/pause` | instructor | LiveSession PAUSED; stop teaching timer |
| POST | `/api/lessons/:id/resume` | instructor | → LIVE; resume timer |
| POST | `/api/lessons/:id/end` | instructor | → ENDED; start recording pipeline |
| POST | `/api/lessons/:id/join` | student/instructor | Full authz chain → short-lived join token |
| POST | `/api/live/signal` | token+session | Signaling; must re-validate token + enrollment + state (WAITING or LIVE as allowed) |
| POST | `/api/live/moderate` | instructor | mute/cam/remove/session-ban |
| GET | `/api/live/sessions/:id/timer` | participants | Server authoritative teaching seconds |

**Waiting room:** signal/chat allowed; teaching media tracks not started until LIVE.

**Deprecate behavior:** rejecting all non-`live` statuses for waiting-room presence.

---

## 6. Chat / media / recording

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET/POST | `/api/lessons/:id/chat` | enrolled (+ staff) | **No public GET** |
| GET | `/api/media/lessons/:assetId` | enrolled | Private material stream |
| GET | `/api/media/recordings/:id` | enrolled; recording PUBLISHED (or policy) | Range stream |
| POST | `/api/teacher/recordings/:id/preview` | instructor | Preview edits |
| POST | `/api/teacher/recordings/:id/publish` | instructor | Confirm publish |
| POST | `/api/cron/recordings/auto-publish` | CRON_SECRET | 24h after READY |
| POST | `/api/mux/webhook` | **signature verify** + idempotent | Processing updates |

---

## 7. Notifications

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET/PATCH | `/api/notifications` | user | List / mark read |
| GET | `/api/cron/notifications/course-tomorrow` | CRON | Day-before |
| GET | `/api/cron/lesson-reminders` | CRON | Keep/adapt |
| PATCH | `/api/settings/telegram` | user | Link chat (optional) |

---

## 8. Certificates / assignments

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/teacher/certificates` | instructor of course | Issue + upload; must verify enrollment |
| GET | `/api/certificates/:id` | owner or admin (not any teacher) | View/print |
| POST | `/api/assignments` / submit / grade | existing + enrollment checks | Optional |

---

## 9. Admin ops

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/admin/action-required` | admin | Queue |
| GET | `/api/admin/system-health` | admin | Metrics (no secrets) |
| GET | `/api/admin/incidents` | admin | List |
| POST | `/api/admin/incidents/:id/ack` | admin | Acknowledge |
| GET | `/api/admin/audit` | admin | Audit log |

---

## 10. Error contract

Use stable codes: `UNAUTHENTICATED`, `FORBIDDEN`, `ENROLLMENT_REQUIRED`, `ACCOUNT_RESTRICTED_PURCHASE`, `LESSON_NOT_JOINABLE`, `TOKEN_EXPIRED`, `CONFLICT_SCHEDULE`, `CAPACITY_FULL`, `IDEMPOTENT_REPLAY`, `REFUND_NOT_ALLOWED`.

Do not leak other users’ existence beyond necessary.

---

## 11. CURRENT routes to retire (after flags)

- `POST /api/enroll`
- Tariff-only checkout without courseId
- Public `GET /api/lessons/:id/chat`
- Unauthenticated `GET /uploads/lessons/:filename` (replace with media API)
- Unsigned Mux webhook behavior
