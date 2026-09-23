# Lexify — Final Product Specification

**Date:** 2026-09-23
**Status:** Product decisions consolidated; implementation planning phase

## 1. Authoritative product model

Lexify sells individual **courses**.

**Target:** Course → Purchase → Payment → Enrollment → My Courses → Lessons → Live/Recording/Materials → History

Remove from the user-facing model: Tariff, Entitlement, Subscription, TeacherPicker, T1/T2/T3, 30-day access expiry.

A student can own multiple courses simultaneously. One enrollment never expires another enrollment.

## 2. Course

Teacher creates a draft and submits it to Admin. Admin can request changes/reject with reason. Admin sets price and publishes. Only published courses are publicly purchasable.

Course contains title, topic, descriptions, teacher, approximate start date, lesson count, lesson topics/descriptions, schedule, capacity and materials.

Teacher does not set price. If Admin changes price, old purchasers retain their original purchase price; new buyers use the new price.

Default capacity is unlimited. Optional max capacity can be set. When full, purchase closes and the card shows `Joylar tugagan`.

Admin may create a course on behalf of an existing teacher.

## 3. Course completion/history

Student attendance is **not required** for course completion or access.

Student progress is separate from course lifecycle (e.g. 0/13, 7/13, 13/13).

After all currently planned topics/lessons are completed, Teacher may either:
- add additional lessons, or
- finish the course.

Additional lessons are normal lessons marked `Qo‘shimcha dars` and require topic/date/time. Conflict detection applies and students are notified.

Teacher cannot finish a course while currently planned lessons/topics remain incomplete. Finishing requires confirmation and shows a summary. Completed courses move to History. Published recordings/materials remain permanently accessible.

## 4. Payment/refund

V1 remains **demo payment**; real Payme/Click is planned later.

Successful payment automatically creates Purchase + Enrollment. Admin monitors but does not manually approve every successful purchase.

Payment architecture must support idempotency, duplicate prevention and authoritative states.

Refund policy:
- before course starts: 100% refund request;
- after start: no normal refund function;
- serious teacher/course issue: Support → Admin;
- if justified and progress is under 50%, Admin may issue 50% refund;
- at 50%+ the special 50% rule does not apply;
- refund immediately closes live, recording and material access;
- student may purchase again later.

Whole-course cancellation: all purchasers receive 100% refund + site notification + Telegram when linked.

## 5. Lesson/live lifecycle

Lesson:
`SCHEDULED → WAITING_ROOM → LIVE ↔ PAUSED → ENDED → RECORDING_PROCESSING → RECORDING_READY → TEACHER_REVIEW → PUBLISHED`

Separate `CANCELLED` state.

Waiting room is opened by Teacher. It has student list, chat and a prominent “Dars tez orada boshlanadi” message, but no teaching audio/video. Teacher may start with any number of students.

If Teacher never starts after opening waiting room, the lesson is considered not held, Admin is informed, students are notified, and the same topic must be rescheduled.

Teacher may change schedule at least 24h before lesson start. Students are notified. If the new time conflicts with another Teacher course, the change is blocked. Teacher may start early if the system detects no conflict.

## 6. Live duration

Maximum **60 minutes of actual teaching time**. Pause time does not count.

Teacher may end at any time before 60 minutes.

Warnings at 55m, 58m and 59m of actual teaching time. At 60m the system auto-ends.

Teacher disconnect pauses/interrupts the session and stops the teaching timer where technically possible. Student disconnects may reconnect without teacher permission; disconnected time is not attendance.

One active live session per student account. Device switching closes the old session and continues attendance through the new session.

## 7. Attendance

Attendance is for analytics, teacher evaluation and certificate decisions, not access/history eligibility.

Record exact join/leave/rejoin intervals and total live participation. Waiting-room presence is not live teaching attendance. Late joining is allowed.

## 8. Live security

**LINK ≠ ACCESS.**

Protected access requires authenticated user + account eligibility + active enrollment + correct course/lesson + joinability + short-lived live join token.

Chat, recordings, materials and live signaling are enrollment-gated.

Use risk-based security: unknown device, unusual network/location signals, rapid device changes and suspicious patterns may trigger extra verification. No constant CAPTCHA.

## 9. Live moderation and existing UI/UX

Preserve the existing Live Room UI/UX and adapt its business logic to the new model.

Student camera and microphone are OFF by default. Teacher grants/revokes permission. Student may raise a hand. Teacher can mute a student, turn off camera, require permission again, mute everyone, disable all cameras and remove a student from the current Live Session.

Removal is session moderation, not course/account removal. Teacher can choose a reason and optionally block re-entry for the remainder of that live session.

Existing chat remains. Existing material presentation remains: Teacher selects material, presents it, page changes synchronize to students, and Teacher can annotate.

Interactive whiteboard exists behind a button and supports writing/drawing/shapes/eraser/undo/redo/clear.

Screen sharing supports the required whole-screen/window/browser-tab/media use cases.

## 10. Live content protection

Use one **Live Content Protection** subsystem rather than many separate rules.

Watermark applies only to live video, is normally hidden, and appears when screen recording is technically detected. It is not periodic, not permanent, and not placed over presented materials.

Watermark contains: student name + course name + date/time.

Detection does not stop the session, warn the user, or create punitive action by itself.

The system must not promise impossible 100% prevention of external capture.

## 11. Recording

After lesson end, recording is processed automatically.

`PROCESSING` time is technical time and does not count against the teacher review window.

When `READY`, Teacher has **24 hours** to review/publish. Teacher can edit/trim large or small sections, Undo/Redo and Preview the student-facing result.

Publish requires confirmation. After publish, the recording is final through the normal teacher UI and becomes available to students.

If Teacher does nothing, 24h after READY the system auto-publishes.

Student sees understandable states: recording preparing / teacher reviewing / coming soon.

Publish triggers My Courses visibility + site notification + Telegram if linked.

If recording fails technically: lesson remains held; Teacher and Admin are notified; incident is created; student is informed; Teacher can add an explanation/material.

## 12. System health and self-healing

Admin gets System Health / Infrastructure monitoring for database/storage, server disk, CPU/RAM, recording storage, Mux/API quota, live infrastructure, jobs/cron, Telegram, payment/webhooks and error rates where technically measurable.

Secrets/tokens/passwords are never exposed.

System should predict approaching limits and send alerts with cause, expected risk/time and recommended action.

Safe automatic actions may include temporary/cache cleanup, safe failed-job retries and safe API/webhook reconnect/retry.

Never automatically delete/alter students, courses, payments, enrollments or published recordings.

If safe recovery fails: limited retries → Critical Alert → Incident → Admin Action Required.

Incident levels: INFO, WARNING, HIGH, CRITICAL.

## 13. Admin

Admin Control Center includes:
- course review/change requests/rejection/approval/publish/unpublish;
- price management;
- capacity;
- students/enrollments;
- payments/refunds;
- teacher replacement;
- live monitoring;
- security;
- audit log;
- incidents;
- Action Required;
- System Health.

Unpublish requires a reason and impact preview for existing students.

Teacher replacement filters suitable teachers by specialty/topic and schedule conflict. Students are notified. If no replacement exists, Admin handles course cancellation/refund.

## 14. Teacher

Teacher Studio contains course management, schedules, students, lessons, live controls, recordings, attendance, assignments and certificate actions.

Teacher may issue a certificate based on student activity (attendance, lesson activity, assignments and other data) and uploads the certificate manually. No automatic generation and no Admin approval required. Admin can view certificate history.

Assignments are optional; if created, students submit and Teacher reviews. They are not required for course completion.

Tests/quizzes are planned future functionality and must not be required by the current completion rules.

## 15. Notifications/Telegram

Site Notification Center is persistent, with read/unread state and filtering.

Site notifications are mandatory. Telegram is optional and only used when linked.

Important events include course publication, purchase success, tomorrow reminder, lesson reminders, teacher start, schedule changes, cancellation, teacher change, refund and recording publication.

Course Telegram group is optional and is for **post-lesson discussion and teacher announcements**, not the authoritative live system.

Support is available through a platform ticket workflow plus phone/Telegram/direct support.

## 16. Student feedback/profile

Teacher performance statistics should include course/student counts, attendance, lesson delivery, recording publishing discipline, feedback and technical indicators.

Student feedback is not required for the core course flow. If feedback is implemented, the architecture must support it; public display remains a later product decision.

Course detail includes teacher summary and a route to the full Teacher profile.

## 17. Account security terminology

The implementation must not use one ambiguous `isBlocked` flag for commerce, account state and security access.

The latest product decision is that an account restriction prevents **new purchases**, while existing course ownership is not automatically destroyed. Separate live/security controls may still restrict access when required by the security policy.

## 18. Legacy removal

Eventually migrate/remove:
- Tariff UI and platform prices
- Entitlement
- TeacherPicker/onboard student flow
- T1/T2/T3
- Subscription as authoritative access
- 30-day endsAt access
- expire-other-subscriptions
- old plan/access gates
- public media access
- process-local global live rooms
- old progress definition
- obsolete TDYU/opentsul/ot naming where appropriate

Shorts remains a separate future content subsystem.

## 19. Implementation order

1. Freeze this specification.
2. Target domain model/schema.
3. Migration mapping and rollback plan.
4. Purchase/Payment/Enrollment/access layer.
5. Course review/price/publish.
6. Student catalog/checkout/My Courses.
7. Schedule conflict engine.
8. Live security/join token.
9. Waiting Room/live/pause/60m timers.
10. Recording lifecycle/24h auto-publish.
11. Refund/cancellation/teacher replacement.
12. Notifications/Telegram.
13. Admin Action Required/incidents/System Health.
14. Certificates/assignments.
15. Legacy migration/removal.
16. Full E2E/security testing.

## 20. Non-negotiable acceptance tests

Test at minimum:
- shared URL without enrollment denied;
- cross-course access denied;
- chat/recording/material access denied without enrollment;
- refunded access immediately denied;
- duplicate payment/webhook cannot duplicate purchase/enrollment;
- teacher cannot cross-access another course;
- student cannot access another student's certificate;
- short-lived join token required;
- late join/reconnect/device switch;
- pause excludes time from 60m;
- 55/58/59 warnings;
- 60m automatic end;
- recording 24h auto-publish;
- recording failure incident;
- course cancellation 100% refund;
- pre-start 100% refund;
- justified under-50% post-start 50% refund;
- multiple courses simultaneously;
- schedule conflict blocking;
- teacher replacement;
- critical infrastructure incident/self-healing;
- auditability of privileged/destructive actions.

## 21. Current audit interpretation

The current audit proves the existing implementation is not yet target-compliant: tariff/entitlement/subscription commerce, one-active-subscription behavior, 30-day expiry, waiting-room/live mismatch, weak/public media/chat access, demo-only payment, missing Purchase/Enrollment, weak recording lifecycle, old progress/history semantics, missing schedule conflict, missing pause/60m controls and incomplete notification/security controls all require migration or replacement.

This specification is the TARGET. Current code remains the CURRENT until implementation and migration are completed.
