# PART 13 — Final Audit Handoff

## 13.1 Product summary

**Lexify** (code name remnants: TDYU Live / Open Tsul) is a **paid live-class LMS** for Tashkent State University of Law. Students buy a **30-day platform tariff** (t1 recordings / t2 live / t3 live+priority), then typically **select one teacher**. That creates a **course subscription**. Teaching happens in **in-browser WebRTC classrooms** with optional Mux RTMP/VOD and local webm recordings. Payments in this repository are **demo_paid only**. Three roles: student, teacher, admin (plus email super-admin).

## 13.2 User roles

- **student** — default signup; pays; enrolls; watches; submits
- **teacher** — invite or admin provision; studio, live, group, grades, certs
- **admin** — layout-gated; users, teachers, courses, payments, impersonate teachers
- **super-admin** — email allowlist; plaintext password reveal/reset

## 13.3 Core entities

User, Teacher, TeacherInvite, Faculty, Subject, Course, Lesson, LessonAsset, Entitlement, Subscription, Payment, Attendance, Assignment, Submission, Certificate, Notification, ChatMessage, PasswordResetToken, SiteSetting (unused).

Live session and Shorts and Progress are **not tables**.

## 13.4 Core business rules (extracted)

| RULE | SOURCE | FUNCTION | EFFECT |
|------|--------|----------|--------|
| T1 cannot watch live/lobby | `src/lib/tariffs.ts` `canWatchLive`; `access.ts` `getLessonAccess` | live_locked paywall | |
| T2/T3 can watch live | same | MeetRoom if status live | |
| T1 can watch ended recordings | `getLessonAccess` skips live check when ended | | |
| T2/T3 chat | `chat/route.ts` `canUseLiveChat` | 403 otherwise | |
| T3 chat priority flag | `isPriorityTier` | CSS badge | |
| T3 grade first | `teacher/assignments/page.tsx` `tierRank` | sort only | |
| Subscription 30 days from **now** on each demo pay | `payments/demo` `addDays(now,30)` | not calendar month; not remainder extend | |
| Lesson access uses Subscription not Entitlement | `getLessonAccess` | paid-but-not-enrolled cannot watch | |
| Cabinet needs any active Subscription | `requireStudentCabinet` | else onboard or #tariflar | |
| Enroll requires Entitlement | `enroll/route.ts` | 403 “Avval tarif to'lang” | |
| Enroll expires other active course subs | same | one active course on this path | |
| Enroll uses teacher’s first/workspace course | `ensureTeacherWorkspace` findFirst | not a course picker | |
| Teacher must have userId to enroll | enroll 404 | invite pending teachers hidden on onboard | |
| Unique one sub per user+course | schema | upsert renews same row | |
| Unique one entitlement per user | schema | pay overwrites | |
| Unique attendance per user+lesson | schema | page open once | |
| Unique submission per assignment+user | schema | resubmit overwrites | |
| Unique cert per user+course | schema | reissue updates issuedAt | |
| Lesson scheduled not watchable | `getLessonAccess` not_started | | |
| Lesson delete only scheduled | teacher PATCH/DELETE route | | |
| Lesson patch blocked in lobby/live | same | | |
| Signal API only if status live | `liveGate` | lobby UI broken | |
| Start allowed from scheduled or lobby | start/route | skip lobby | |
| End has no status guard | end/route | can end scheduled | |
| Live notify t2+ only | `notifyCourseStudents(...,"t2")` | t1 not pinged for live | |
| End/VOD notify all tiers | end + mux webhook no minTier | | |
| Reminders 15 minutes scheduled | `lesson-reminders.ts` | t1 included | |
| Demo payment any logged-in role | payments/demo | | |
| Revenue = demo_paid + paid | admin-stats | demo counted | |
| Blocked users rejected at login | auth.ts | not on each request | |
| Super-admin email default | super-admin.ts | avazov@tdyu.live | |
| Login alias `avazov` | impersonate `resolveLoginId` | | |
| Google signup always student | syncGoogleUser | | |
| Course default published | schema isPublished true | | |
| Assignment submit ignores dueAt | assignments/submit | late allowed | |
| Certificate no eligibility | teacher/certificates | | |
| Staff bypass learn/media/chat/signal | those files | admin or owning teacher | |
| Impersonate teachers only | auth.ts ticket | | |
| Seed forbidden in production | prisma/seed.ts NODE_ENV | | |

## 13.5 Pricing model

Platform list: t1 150000, t2 250000, t3 400000 so'm / 30 days. Course can override three ints. Checkout without courseId uses platform; with courseId uses course.

## 13.6 Access model

```
JWT session
 → role routing
 → student: Subscription(user, course) active?
      → if lesson scheduled: deny
      → if lobby/live: require t2|t3
      → if ended: any tier
 → Entitlement: onboarding ticket only
```

## 13.7 Subscription model

Row per user+course with tier window. Enroll copies entitlement dates/tier and kills other actives. Course-pay upserts without killing others. Admin can extend/cancel independently of entitlement.

## 13.8 Payment model

Single endpoint demo. Always `demo_paid`. Provider field cosmetic. No refunds. Duplicate posts allowed.

## 13.9 Course model

Teacher-owned, faculty+subject, three prices, isPublished. Auto workspace course named after subject. Multiple courses per teacher allowed in DB; enroll ignores extras.

## 13.10 Lesson model

scheduled → lobby → live → ended. Extra fields for Mux and local recordingUrl. Assets on disk.

## 13.11 Live model

In-memory WebRTC SFU-less mesh signaling + optional Mux RTMP. STUN only. Recording via MediaRecorder upload. **Lobby is a status + UI, not a working signaling state.**

## 13.12 Progress model

No table. Learn % = share of lessons that are ended **and** have a non-demo recording. Position k/N is playlist index.

## 13.13 Attendance model

One row when eligible user opens learn in lobby/live/ended. joinedAt only. Used as “watched” and “davomat”.

## 13.14 Student / teacher / admin flows

See PART 7–9. Shortest:

Student: register → pay demo → pick teacher → cabinet → learn/assignments.
Teacher: invite → studio → reja → lobby/start/end → group/certs → grade.
Admin: login → KPI → invite teachers → edit courses/prices → block/extend → view demo payments.

## 13.15 Important routes

`/`, `/checkout`, `/onboard`, `/app`, `/learn/[id]`, `/teacher`, `/teacher/live/[lessonId]`, `/admin`, `/admin/users`.

## 13.16 Important APIs

`POST /api/payments/demo`, `POST /api/enroll`, `getLessonAccess`, teacher lobby/start/end, `POST /api/live/signal`, `POST /api/mux/webhook`.

## 13.17 Important DB models

User, Entitlement, Subscription, Course, Lesson, Payment, Attendance.

## 13.18 Known inconsistencies

See PART 12. Highest leverage: entitlement≠subscription after upgrade; enroll vs course-pay multiplicity; lobby≠signal; demo counted as revenue; progress/attendance semantics; Payme UI vs demo; TZ catalog vs marketing `/`; SETUP IP vs rules IP.

## 13.19 Unknowns

- Production Mux/Telegram/Resend/Google actually configured?
- Which production IP (3.65 vs 3.79)?
- PM2 fork vs cluster (live rooms)?
- Real `git log` last 50 commits (not dumped here).
- Mobile screenshots.
- Whether Next static-serves `public/uploads/recordings` despite media API.
- Faculty/subject CRUD (none in app — how prod data is edited besides seed/SQL).
- JWT maxAge.
- TURN servers (none in code — NAT students UNKNOWN).
- T3 “queue” besides sort.

## 13.20 High-risk areas for any future change

1. Dual source of truth Entitlement vs Subscription
2. Two enrollment funnels (onboard enroll vs course checkout)
3. Demo payment + analytics treating it as revenue
4. Unsigned Mux webhook
5. Public chat GET + public lesson files
6. In-memory live rooms
7. Cascade deletes Faculty→everything
8. JWT without isBlocked revalidation
9. Certificate IDOR (any teacher)
10. `ensureTeacherWorkspace` findFirst course choice

## 13.21 Files that must be inspected before changing pricing, access, live, or payments

```
prisma/schema.prisma
src/lib/tariffs.ts
src/lib/access.ts
src/lib/plan.ts
src/lib/home-path.ts
src/app/api/payments/demo/route.ts
src/app/api/enroll/route.ts
src/components/course/CheckoutClient.tsx
src/app/checkout/page.tsx
src/app/onboard/page.tsx
src/components/student/TeacherPicker.tsx
src/app/learn/[id]/page.tsx
src/app/api/live/signal/route.ts
src/lib/live-rooms.ts
src/components/live/MeetRoom.tsx
src/app/api/teacher/lessons/[id]/{lobby,start,end}/route.ts
src/lib/mux.ts
src/app/api/mux/webhook/route.ts
src/lib/admin-stats.ts
src/lib/admin-courses.ts
src/lib/notify.ts
src/lib/auth.ts
src/lib/roles.ts
src/lib/super-admin.ts
src/components/layout/Sidebar.tsx
src/app/app/page.tsx
src/app/page.tsx
```

## 13.22 Real architecture (code), not the requested sketch

The sketch “USER → AUTH → ONBOARDING → TARIFF → … → ENTITLEMENT → TEACHER → COURSE → SUBSCRIPTION” is **not** the coded order.

**Coded primary funnel:**

```
USER
 ↓
AUTH (register/login/Google)
 ↓
TARIFF (landing prices)
 ↓
PAYMENT (always demo_paid)
 ↓
ENTITLEMENT (1:1 user, 30d)
 ↓
ONBOARDING teacher pick   ← skipped if courseId checkout
 ↓
TEACHER.workspace COURSE (findFirst / create)
 ↓
SUBSCRIPTION (copy entitlement; expire others on enroll)
 ↓
CABINET /app
 ↓
LESSON
 ├── scheduled  → paywall not_started
 ├── lobby      → UI MeetRoom; signal DENIED
 ├── live       → MeetRoom + signal if t2/t3
 ├── ended      → recording if playable; all tiers
 └── (no cancelled)
 ↓
ATTENDANCE (learn page open)
 ↓
ASSIGNMENT / SUBMISSION (due not enforced)
 ↓
CERTIFICATE (manual teacher, no eligibility)
```

**Alternate funnel:** `/courses/[id]` → checkout with courseId → Entitlement **and** Subscription in one POST → `/app` (no onboard; other subs not expired).

**Upgrade:** new PAYMENT + overwrite ENTITLEMENT; SUBSCRIPTION may remain old tier.

## 13.23 Prioritized findings (no fix proposals)

### P0 — business / data / access

**ID:** P0-1
**CATEGORY:** access / billing
**SEVERITY:** P0
**TITLE:** Entitlement upgrade does not update Subscription (lesson source of truth)
**FACT:** `payments/demo` upserts entitlement; `getLessonAccess` reads subscription only.
**WHY IT MATTERS:** User can pay t2/t3 and still be live_locked on existing course.
**EVIDENCE:** `src/app/api/payments/demo/route.ts`; `src/lib/access.ts` `getLessonAccess`
**AFFECTED ROLE:** student
**AFFECTED FLOW:** upgrade from landing
**DEPENDENCIES:** checkout, enroll, learn

**ID:** P0-2
**CATEGORY:** live
**SEVERITY:** P0
**TITLE:** Lobby classroom UI vs signaling requires live
**FACT:** MeetRoom shown for lobby; `liveGate` returns ok only if `status==="live"`.
**WHY IT MATTERS:** “Kutish xonasi” cannot actually connect.
**EVIDENCE:** `learn/[id]/page.tsx`; `LiveStudio.tsx`; `api/live/signal/route.ts`
**AFFECTED ROLE:** student t2/t3, teacher
**AFFECTED FLOW:** lobby
**DEPENDENCIES:** MeetRoom, lesson status

**ID:** P0-3
**CATEGORY:** billing analytics
**SEVERITY:** P0
**TITLE:** demo_paid is summed as monthly revenue
**FACT:** `status in [demo_paid, paid]` in admin-stats and payments chart.
**WHY IT MATTERS:** Admin KPI “Shu oy to‘lov” is not collected money.
**EVIDENCE:** `src/lib/admin-stats.ts`; `admin/payments/page.tsx`
**AFFECTED ROLE:** admin
**AFFECTED FLOW:** dashboard
**DEPENDENCIES:** Payment.status

**ID:** P0-4
**CATEGORY:** enrollment
**SEVERITY:** P0
**TITLE:** Two contradictory multi-course policies
**FACT:** enroll expires other actives; course checkout does not; UI dashboard supports N courses.
**WHY IT MATTERS:** Product question “bir nechta kurs?” has two answers.
**EVIDENCE:** `enroll/route.ts`; `payments/demo/route.ts`; `app/page.tsx`
**AFFECTED ROLE:** student
**AFFECTED FLOW:** second purchase
**DEPENDENCIES:** unique(user,course)

**ID:** P0-5
**CATEGORY:** security
**SEVERITY:** P0
**TITLE:** Mux webhook has no authenticity check
**FACT:** POST `/api/mux/webhook` parses JSON and can set lesson ended.
**WHY IT MATTERS:** Unauthenticated caller can end lessons / attach playback ids if URL is reachable.
**EVIDENCE:** `src/app/api/mux/webhook/route.ts`
**AFFECTED ROLE:** all
**AFFECTED FLOW:** lesson end
**DEPENDENCIES:** Mux

### P1 — major UX / product inconsistency

**ID:** P1-1 Progress labeled as course progress but is VOD readiness — `learn/[id]/page.tsx`
**ID:** P1-2 Attendance labeled watched/davomat but is page open — same file + history + teacher group
**ID:** P1-3 Payme/Click UI vs demo backend — CheckoutClient
**ID:** P1-4 PLATFORM_PRICES vs course.priceT* — landing vs course vs seed c2
**ID:** P1-5 Cannot switch teacher in UI while sub active; API can — onboard vs enroll
**ID:** P1-6 Shorts/shell tier from getAnyActiveSubscription not max(tier) — access.ts + shorts + Sidebar
**ID:** P1-7 TZ catalog home vs marketing landing; unused HomeContent
**ID:** P1-8 Certificate eligibility copy vs unrestricted API
**ID:** P1-9 System notifications href `/learn/{relatedId}` when relatedId is course or teacher
**ID:** P1-10 Grade notifications have no bell link

### P2 — medium

**ID:** P2-1 JWT ignores later isBlocked
**ID:** P2-2 Chat GET and lesson uploads public
**ID:** P2-3 Duplicate payments inflate revenue
**ID:** P2-4 Admin entitlement vs subscription independent extend
**ID:** P2-5 Teacher layout no auth (page-level only)
**ID:** P2-6 Cron telegram-poll open if CRON_SECRET unset
**ID:** P2-7 In-memory live rooms / rate limits
**ID:** P2-8 Assignment dueAt not enforced
**ID:** P2-9 Seed ended lesson uses demo_ playback (not playable)
**ID:** P2-10 SETUP.md vs rules production IP
**ID:** P2-11 Certificate view: any teacher
**ID:** P2-12 payments/demo not student-only
**ID:** P2-13 Language field unused; i18n names on faculty only
**ID:** P2-14 Redis compose unused
**ID:** P2-15 requireRole unused

### P3 — polish

**ID:** P3-1 Dead TeacherHub, TeacherStudioFocus, HomeContent
**ID:** P3-2 localStorage keys still `ot-*`
**ID:** P3-3 Docker names opentsul
**ID:** P3-4 No loading.tsx/error.tsx
**ID:** P3-5 Settings stub copy
**ID:** P3-6 E2E only landing
**ID:** P3-7 SiteSetting model unused
**ID:** P3-8 Privacy “delete account” has no API

---

This handoff is sufficient to audit without opening the repo **if** the other PART files in this folder are kept together.

END OF PART 13
