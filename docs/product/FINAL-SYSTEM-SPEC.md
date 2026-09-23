# Lexify — Final System Specification (Frozen)

**Source:** `LEXIFY_FINAL_PRODUCT_SPEC.md` (2026-09-23)
**Status:** Frozen for implementation planning
**Rule:** This document is TARGET. Audit packs under `docs/audit/` and `docs/download/` describe CURRENT only.

---

## 1. Authoritative product model

Lexify sells individual **courses**.

```
Course → Purchase → Payment → Enrollment → My Courses → Lessons → Live/Recording/Materials → History
```

**Remove from user-facing model:** Tariff, Entitlement, Subscription, TeacherPicker, T1/T2/T3, 30-day access expiry.

A student can own multiple courses simultaneously. One enrollment never expires another enrollment.

---

## 2. Course

- Teacher creates draft and submits to Admin.
- Admin can request changes / reject with reason.
- Admin sets price and publishes.
- Only published courses are publicly purchasable.
- Course contains: title, topic, descriptions, teacher, approximate start date, lesson count, lesson topics/descriptions, schedule, capacity, materials.
- Teacher does **not** set price.
- If Admin changes price: old purchasers keep original purchase price; new buyers use new price.
- Default capacity: unlimited. Optional max capacity; when full → purchase closed, card shows `Joylar tugagan`.
- Admin may create a course on behalf of an existing teacher (`createdBy` ≠ `instructor`).

---

## 3. Course completion / history

- Student attendance is **not required** for course completion or access.
- Student progress is separate from course lifecycle (e.g. 0/13, 7/13, 13/13).
- After all currently planned topics/lessons are completed, Teacher may:
  - add additional lessons (`Qo‘shimcha dars`, topic/date/time, conflict detection, student notify), or
  - finish the course (confirmation + summary).
- Teacher cannot finish while planned lessons/topics remain incomplete.
- Completed courses move to History.
- Published recordings/materials remain **permanently** accessible.

---

## 4. Payment / refund

- V1: **demo payment** OK; real Payme/Click later.
- Successful payment auto-creates **Purchase + Enrollment**. Admin monitors; does not approve every success.
- Must support: idempotency, duplicate prevention, authoritative states.

**Refund policy:**

| Case | Rule |
|------|------|
| Before course starts | 100% refund request |
| After start (normal) | No normal refund button |
| Serious teacher/course issue | Support → Admin |
| Justified + progress &lt; 50% | Admin may issue 50% |
| Progress ≥ 50% | Special 50% rule does not apply |
| Any refund granted | Immediately closes live, recording, material access |
| Student later | May purchase again |
| Whole-course cancellation | 100% refund to all purchasers + site + Telegram (if linked) |

---

## 5. Lesson / live lifecycle

```
SCHEDULED
  → WAITING_ROOM
  → LIVE ↔ PAUSED
  → ENDED
  → RECORDING_PROCESSING
  → RECORDING_READY
  → TEACHER_REVIEW
  → PUBLISHED
```

Separate: `CANCELLED`.

- Waiting room: opened by Teacher; student list + chat + “Dars tez orada boshlanadi”; **no teaching A/V**.
- Teacher may start with any number of students.
- If Teacher opens waiting room but never starts: lesson not held → Admin informed → students notified → topic must be rescheduled.
- Schedule change: ≥24h before start; students notified; blocked on Teacher conflict. Early start allowed if no conflict.

---

## 6. Live duration

- Max **60 minutes actual teaching time**. Pause does **not** count.
- Teacher may end earlier.
- Warnings at **55m, 58m, 59m** actual teaching time. At 60m: auto-end.
- Teacher disconnect: pause/interrupt; stop teaching timer where possible.
- Student disconnect: reconnect without teacher permission; disconnected time ≠ attendance.
- One active live session per student account. Device switch closes old session; attendance continues on new.

---

## 7. Attendance

- For analytics, teacher evaluation, certificate decisions — **not** access/history eligibility.
- Record join/leave/rejoin intervals and total live participation.
- Waiting-room presence ≠ live teaching attendance.
- Late joining allowed.

---

## 8. Live security

**LINK ≠ ACCESS.**

Chain: authenticated user → account eligibility → active enrollment → correct course/lesson → joinability → short-lived live join token.

Chat, recordings, materials, live signaling: enrollment-gated.

Risk-based extras (unknown device, unusual network, rapid device changes) OK. No constant CAPTCHA.

---

## 9. Live moderation / UI

- Preserve existing Live Room visual UI/UX; adapt business logic.
- Student cam/mic OFF by default; Teacher grant/revoke.
- Raise hand; mute; cam off; mute all; disable all cams; remove from **session** (not course/account).
- Removal: reason optional; optional block re-entry for remainder of that live session.
- Existing chat, material presentation (sync pages + annotate), whiteboard (draw/shapes/eraser/undo/redo/clear), screen share — keep/adapt.

---

## 10. Live content protection

One subsystem. Watermark on live video only: normally hidden; appears when screen recording detected. Content: student name + course name + date/time. Detection alone does not stop session or punish. No promise of 100% external capture prevention.

---

## 11. Recording

- After end: automatic processing.
- `PROCESSING` time does **not** count against teacher review window.
- When `READY`: Teacher has **24h** to edit/trim, Undo/Redo, Preview, Publish (confirmation required).
- After publish: final via normal teacher UI; available to students.
- If Teacher does nothing: auto-publish 24h after READY.
- Student UI: preparing / teacher reviewing / coming soon.
- Publish → My Courses visibility + site notification + Telegram if linked.
- Technical failure: lesson still held; Teacher+Admin notified; Incident; student informed; Teacher may add explanation/material.

---

## 12. System health / self-healing

Admin System Health: DB/storage, disk, CPU/RAM, recording storage, Mux/API quota, live infra, jobs/cron, Telegram, payment/webhooks, error rates (where measurable).

Predict approaching limits; alert with cause, risk/time, recommended action.

Safe auto: temp/cache cleanup, safe job retries, safe API/webhook reconnect.
**Never** auto-delete students, courses, payments, enrollments, published recordings.

Failed recovery: limited retries → Critical Alert → Incident → Action Required.
Levels: INFO, WARNING, HIGH, CRITICAL.

Secrets never exposed in UI.

---

## 13. Admin Control Center

Course review / changes / reject / approve / publish / unpublish; price; capacity; students/enrollments; payments/refunds; teacher replacement; live monitor; security; audit log; incidents; Action Required; System Health.

Unpublish: reason + impact preview for enrolled students.

Teacher replacement: filter by specialty/topic + schedule conflict; notify students; if none → cancel/refund path.

---

## 14. Teacher Studio

Course management, schedules, students, lessons, live, recordings, attendance, assignments, certificates.

Certificate: Teacher issues based on activity data; **uploads manually**. No auto generation; no Admin approval required. Admin can view history.

Assignments optional; not required for course completion. Quizzes = future; not required for completion.

---

## 15. Notifications / Telegram

- Site Notification Center: persistent, read/unread, filter. **Mandatory.**
- Telegram: optional when linked.
- Events: course publication, purchase success, tomorrow reminder, lesson reminders, teacher start, schedule changes, cancellation, teacher change, refund, recording publication.
- Optional Telegram group: post-lesson discussion / announcements — **not** authoritative live system.
- Support: ticket workflow + phone/Telegram/direct.

---

## 16. Feedback / profile

Teacher performance stats: course/student counts, attendance, delivery, recording discipline, feedback, technical indicators.

Student feedback optional for core flow. Architecture may support later; public display later.

Course detail: teacher summary + route to full Teacher profile.

---

## 17. Account security terminology

Do **not** use one ambiguous `isBlocked` for commerce, account, and live security.

**Product decision:** account restriction prevents **new purchases**; existing course ownership is not automatically destroyed. Separate live/security controls may still restrict access per security policy.

---

## 18. Legacy removal (eventually)

Tariff UI/platform prices; Entitlement; TeacherPicker/onboard; T1/T2/T3; Subscription as access SoT; 30-day endsAt access; expire-other-subscriptions; old plan/access gates; public media access; process-local live rooms; old progress definition; obsolete TDYU/opentsul/ot naming.

**Shorts** = separate future content subsystem (not deleted as product requirement).

---

## 19. Implementation order

See `docs/implementation/IMPLEMENTATION-ORDER.md`.

## 20. Non-negotiable acceptance tests

See `docs/qa/ACCEPTANCE-TESTS.md`.

## 21. CURRENT vs TARGET

CURRENT code (tariff/entitlement/subscription, lobby/signal mismatch, demo payment, public chat/media, etc.) is **not** target-compliant until migration completes.

**This file = TARGET. Current code = CURRENT.**
