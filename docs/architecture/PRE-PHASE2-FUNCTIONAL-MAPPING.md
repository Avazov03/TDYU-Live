# Pre–Phase 2 Functional Mapping

**Date:** 2026-09-23
**Status:** AUDIT ONLY — no Phase 2 code, no flag ON, no backfill apply
**Authority:** `docs/product/FINAL-SYSTEM-SPEC.md`
**Related:** TARGET-DOMAIN-MODEL, MIGRATION-PLAN, API-PLAN, SECURITY-MODEL, ACCEPTANCE-TESTS, IMPLEMENTATION-ORDER, PHASE1-FEATURE-FLAGS

**Rule:** CURRENT = what the repo does today. TARGET = Final Spec. Phase 1 only added empty/additive schema + OFF flags.

---

## 0. Executive cutover posture

```
OLD (today) → DUAL (flags) → TARGET (Enrollment SoT) → LEGACY OFF → LEGACY DELETE
```

Do **not** big-bang rewrite. Every subsystem below is classified at the end.

---

## 1. STUDENT FLOW

| Step | CURRENT route / UI | CURRENT API / server | CURRENT model | CURRENT authz | Legacy dependency | TARGET | Migration strategy | Flag | Risk |
|------|--------------------|----------------------|---------------|---------------|-------------------|--------|-------------------|------|------|
| Guest | `/` landing | SSR session | — | public | Tarif CTA `#tariflar` | Catalog of published courses | Replace landing commerce section | `FF_DISABLE_TARIFF_UI` | Wrong discovery |
| Catalog | `/search`, CourseCard; no dedicated `/courses` list | `search/page`, `/api/search/suggest` | `Course.isPublished` | public suggest **unauth** | `priceT1` “dan” | Published catalog | New catalog API/UI | later | Public suggest leak |
| Course detail | `/courses/[id]` | SSR; `getActiveSubscription` | Course + priceT1/2/3 | published only | Triad pricing | Single `listPrice` + Purchase CTA | Dual price read | `FF_COURSE_CHECKOUT_V2` | Price mismatch |
| Purchase intent | CheckoutButton → `/checkout?tier=&courseId?` | — | — | login on checkout | **Tier required** | Course-only checkout | Drop tier from UX | checkout v2 | Breaking old links |
| Payment | `CheckoutClient` → `POST /api/payments/demo` | demo route | `Payment` `demo_paid`, Entitlement, optional Subscription | any logged-in role | Tariff + Entitlement | Payment→Purchase→Enrollment txn | New confirm API | `FF_COURSE_CHECKOUT_V2` | Duplicate pay; no txn |
| Enrollment | `POST /api/enroll` **or** courseId on demo pay | enroll / demo | `Subscription` | student + Entitlement | TeacherPicker; **expires other subs** | Enrollment from Purchase only | Backfill + dual-read | `FF_ENROLLMENT_ACCESS` then disable enroll | Multi-course loss |
| My Courses | `/my-courses` | SSR subscriptions | Subscription | `requireStudentCabinet` | endsAt / tier labels | Enrollment Upcoming/Active/History | Remap board | enrollment access | endsAt vs permanent |
| Upcoming | Partial (`scheduled` lessons in boards) | — | Lesson.scheduled | via sub | No course-level UPCOMING | Enrollment + course start | Derive from schedule | — | Spec vs course SM |
| Active | `/app` Bugun | getActiveSubscriptions | Sub + Lesson | cabinet | Tier live badges | Enrollment + live | Replace SoT | enrollment access | |
| Lessons | `/learn/[id]`, `/schedule` | getLessonAccess | Lesson + Sub | Sub + tier for live | endsAt, tier | Enrollment + joinable | Dual-read access | enrollment access | |
| Waiting Room | MeetRoom `phase=lobby` on learn/studio | `POST .../lobby`; signal **rejects** non-live | `lobby` | getLessonAccess (t2+) | lobby≠signal | WAITING_ROOM + chat, no A/V | Fix gate + status | `FF_LIVE_WAITING_ROOM_V2` | Broken waiting |
| Live | MeetRoom live + signal | `POST /api/live/signal` | Lesson.live + `__tdyuLiveRooms` | liveGate + getLessonAccess | tier; no join token; process memory | Enrollment + token + shared room | Phase 7–8 | live flags | Multi-instance / IDOR peerId |
| Recording | learn video / media API / Mux iframe | `GET /api/media/recording/[id]`; Mux webhook | `recordingUrl`, mux ids | getLessonAccess | endsAt expiry; public disk | Recording PUBLISHED + permanent | Recording entity + accessOpen | recording flag | Public `public/uploads` |
| Materials | LessonAsset; `GET /uploads/lessons/[filename]` | teacher assets upload | LessonAsset | **no auth on GET** | public CORS `*` | Enrollment-gated media | Replace route | — | **P0 leak** |
| History | `/history` | Attendance list | Attendance.joinedAt | requireAppUser | Page-open ≠ completed course | Completed Enrollment History | New semantics | — | Wrong product meaning |
| Permanent replay | Blocked when `endsAt` passed | getLessonAccess expired | Subscription.endsAt | — | 30-day model | accessOpen after complete | Stop using endsAt for access | enrollment access | **P0 vs spec** |

### Current Student happy path (code)

```
/ → #tariflar → /checkout?tier= → POST /api/payments/demo
  → Entitlement → /onboard → TeacherPicker → POST /api/enroll
  → Subscription (expire others) → /app → /learn/[id]
```

### Target Student happy path (spec)

```
Catalog → Course detail → Checkout → Payment → Purchase → Enrollment
  → My Courses → Waiting Room → Live → Recording/Materials → History (permanent)
```

---

## 2. ACCESS SYSTEM

### 2.1 CURRENT ACCESS GRAPH

```
auth() JWT (role, id)  [isBlocked checked at login only — src/lib/auth.ts]
    │
    ├─ requireStudentCabinet / requireAppUser  [src/lib/access.ts]
    │     ├─ getAnyActiveSubscription (endsAt > now)
    │     │     └─ else getActiveEntitlement → redirect /onboard
    │     │           └─ else redirect /#tariflar
    │     └─ home-path.ts same pattern → /app | /onboard | /
    │
    ├─ getLessonAccess(userId, courseId, status)  [access.ts]
    │     ├─ Subscription unique(user,course)
    │     ├─ !sub → no_subscription
    │     ├─ !isSubscriptionActive(endsAt) → expired
    │     ├─ scheduled → not_started
    │     └─ (live|lobby) && !canWatchLive(tier) → live_locked   [tariffs.ts]
    │
    ├─ Callers of getLessonAccess:
    │     ├─ src/app/learn/[id]/page.tsx  (+ staffJoin bypass admin/teacher)
    │     ├─ src/app/api/live/signal/route.ts  liveGate → status===live only THEN getLessonAccess
    │     ├─ src/app/api/media/recording/[id]/route.ts
    │     └─ src/app/api/lessons/[id]/chat/route.ts POST only (GET unauthenticated!)
    │
    ├─ getActiveSubscription (assignments submit)
    ├─ canUseLiveChat / isPriorityTier (chat POST, learn canSend)
    ├─ canWatchLive (shorts, /app badges)
    └─ notifyCourseStudents → Subscription endsAt + optional minTier t2
```

**Files (legacy access dependency):**

| File | Dependency |
|------|------------|
| `src/lib/access.ts` | Subscription, Entitlement, endsAt, tier |
| `src/lib/tariffs.ts` | TariffTier, PLATFORM_PRICES, canWatchLive, canUseLiveChat, isSubscriptionActive |
| `src/lib/home-path.ts` | Entitlement / Subscription |
| `src/lib/notify.ts` | Subscription + tier filter |
| `src/lib/lesson-reminders.ts` | Subscription endsAt |
| `src/lib/telegram/context.ts` | Entitlement, Subscription, onboard URL |
| `src/app/api/enroll/route.ts` | Entitlement; expire other subs |
| `src/app/api/payments/demo/route.ts` | Entitlement + Subscription upsert |
| Learn / chat / media / live / shorts / app / schedule / assignments / my-courses / certificates / search / checkout / page | as above |

**Not checked today:** `purchaseAllowed`, `accountStatus`, Enrollment, `isBlocked` on lesson/media/live (post-login).

### 2.2 TARGET ACCESS GRAPH

```
auth() session
  → account eligibility (purchaseAllowed for checkout; live/security gate separate)
  → Enrollment (user, course) status ACTIVE|COMPLETED && accessOpen
  → Lesson belongs to course
  → Lesson/LiveSession joinable (WAITING_ROOM | LIVE | PUBLISHED recording rules)
  → (live) short-lived join token
  → every signal/media/chat re-validates Enrollment + state
```

**LINK ≠ ACCESS.** No tier. No 30-day endsAt for owned course access. Refund → `accessOpen=false` immediately.

### 2.3 Phase 2 dual-read plan (design only)

| Flag | Behavior |
|------|----------|
| `FF_ENROLLMENT_ACCESS=false` (default) | Current graph only |
| `FF_ENROLLMENT_ACCESS=true` | If Enrollment row exists for (user,course) use it; else fall back Subscription |

**Do not enable until** Subscription→Enrollment backfill dry-run reviewed + apply approved.

---

## 3. COMMERCE

### 3.1 CURRENT paths

| Path | Entry | API | Writes | Access granted |
|------|-------|-----|--------|----------------|
| A Platform tariff | `/checkout?tier=` | `POST /api/payments/demo` | Payment `demo_paid`, Entitlement upsert, **no** Subscription | Onboard only |
| B Course + tier | `/checkout?tier=&courseId=` | same | Payment + Entitlement + Subscription upsert | Immediate that course |
| C Enroll | `/onboard` TeacherPicker | `POST /api/enroll` | Publish course; **expire other active subs**; upsert Subscription from Entitlement | One active course |

**Key files:** `CheckoutClient.tsx`, `checkout/page.tsx`, `api/payments/demo/route.ts`, `api/enroll/route.ts`, `TeacherPicker.tsx`, `onboard/page.tsx`.

### 3.2 Risks (CURRENT)

| Risk | Evidence |
|------|----------|
| Duplicate payment | No idempotency key; double POST → 2 Payment rows |
| Partial failure | Payment insert then entitlement/sub without `$transaction` |
| Non-student can pay | Auth id only |
| Multi-course conflict | Enroll expires others; course pay does not |
| Demo as revenue | `admin-stats` / payments board sum `demo_paid` |

### 3.3 TARGET commerce

```
Course (published, capacity OK, purchaseAllowed)
  → Checkout session (server listPrice, Idempotency-Key)
  → Payment PAID (demo V1 OK if isDemo flagged)
  → Purchase COMPLETED (amount snapshot)
  → Enrollment ACTIVE (accessOpen=true)
  → My Courses
```

| Concern | Requirement |
|---------|-------------|
| Enrollment creation | Same DB transaction as paid Purchase |
| Retry / idempotency | Same key → same Purchase/Enrollment |
| Pay OK, enroll fail | Must not leave paid orphan without enrollment — transactional |
| Access grant | Enrollment only (not Entitlement) |

**Flag:** `FF_COURSE_CHECKOUT_V2` (OFF). Legacy demo route stays until dual-write proven.

### 3.4 Refund (CURRENT vs TARGET)

| | CURRENT | TARGET |
|--|---------|--------|
| Student refund API | **NOT FOUND** | Pre-start 100% request |
| Admin refund | **NOT FOUND** | Policy engine + 50% rule |
| Access on refund | N/A | Immediate close live/recording/materials |
| Course cancel | No cancel SM | 100% all purchasers + notify |

**Code that must change later (not now):** new refund APIs; Enrollment.accessOpen; media/live/chat checks; notify; Admin UI; `FF_REFUNDS_V1`.

**SPEC:** No normal post-start student refund button — needs Support→Admin path (Action Required later).

---

## 4. LIVE

### 4.1 CURRENT trace

| Step | Implementation |
|------|----------------|
| Open waiting | `POST /api/teacher/lessons/[id]/lobby` → status `lobby`; notify t2+ |
| UI waiting | LiveStudio / learn MeetRoom `phase=lobby` |
| Signal | `liveGate`: **`status !== "live"` → deny** (lobby broken) |
| Start | `POST .../start` from lobby\|scheduled; Mux create; status live; notify t2+ |
| Room | `src/lib/live-rooms.ts` → `globalThis.__tdyuLiveRooms` |
| Join/leave/signal | MeetRoom polls `POST /api/live/signal`; peerId client-supplied |
| End | `POST .../end` (no status guard); optional recordingUrl; closeLiveRoom; Mux complete |
| Pause / 60m / warnings | **NOT FOUND** |
| Attendance | Learn page upsert Attendance on open (lobby/live/ended) — not interval |
| Teacher controls | MeetRoom grant/mute/etc. in-memory events |
| Student cam/mic | MeetRoom defaults (OFF until grant) — UI exists |

### 4.2 TARGET deltas (later phases)

WAITING_ROOM signaling allowed (no teaching media); join token; shared rooms; LiveSession timers; pause excludes teaching time; 55/58/59; auto-end 60; AttendanceInterval; one session per student.

**Flag:** `FF_LIVE_WAITING_ROOM_V2`, `FF_LIVE_SHARED_ROOMS`. Preserve MeetRoom UX.

**Hidden legacy:** lobby vs waiting_room dual enum (Phase 1); signal still live-only.

---

## 5. RECORDING

### 5.1 CURRENT

```
Teacher end → optional MediaRecorder upload POST .../recording
  → Lesson.recordingUrl under public/uploads/recordings
  → OR Mux webhook video.asset.ready → status ended + muxVodPlaybackId
  → Student: getLessonAccess + media API or Mux player
  → Notify “Yozuv tayyor” (end or webhook)
```

| Issue | Status |
|-------|--------|
| PROCESSING / TEACHER_REVIEW / 24h auto-publish | **MISSING** |
| Unsigned Mux webhook | **RISK** |
| Recording table unused by runtime | Phase 1 empty |
| endsAt blocks replay | vs permanent access |
| Files under `public/` | Weak |

**Flag later:** `FF_RECORDING_REVIEW_24H`.

---

## 6. MATERIALS / CHAT

| Resource | CURRENT | Authz | TARGET | Risk |
|----------|---------|-------|--------|------|
| Lesson files GET | `src/app/uploads/lessons/[filename]/route.ts` | **None**, CORS `*` | Enrollment media API | **P0** |
| Assignment uploads | `public/uploads/assignments` | URL public | Gated | P1 |
| Chat GET | `api/lessons/[id]/chat` | **None** | Auth + enrollment | **P0** |
| Chat POST | same | getLessonAccess + canUseLiveChat(tier) | Enrollment, any enrolled | Tier legacy |
| Presentation / whiteboard / screenshare | MeetRoom in-memory | Via liveGate | Keep UX; token | Live phases |

---

## 7. TEACHER FLOW

| Step | CURRENT | TARGET gap |
|------|---------|------------|
| Create course | `POST /api/teacher/courses` plan; `isPublished:true`; PLATFORM_PRICES | Must be DRAFT; no teacher price |
| Submit review | **MISSING** | Submit → Admin queue |
| Admin changes/reject | **MISSING** | CourseReviewEvent |
| Approve + price + publish | Admin PATCH prices + isPublished | Atomic approve+listPrice+publish |
| Schedule / conflict | scheduledAt only; **no BE overlap** | Conflict engine + 24h |
| Waiting / live / end | lobby/start/end as above | Full SM |
| Recording review | Immediate if URL set | 24h review / auto-publish |
| Course finish | **MISSING** | Finish after planned lessons |
| Additional lessons | Create lesson only | `isAdditional` flag exists (unused) |
| Certificates | Manual API; no enrollment check | Enrollment-verified + upload |
| Assignments | Optional create/grade | Keep optional |

**Key files:** `teacher/page.tsx`, `reja`, `live/[id]`, `LiveStudio`, `CreateCoursePlanForm`, teacher lesson APIs, `certificates` API.

---

## 8. ADMIN FLOW

| Capability | CURRENT | TARGET |
|------------|---------|--------|
| Course review queue | **MISSING** | Required |
| Set price | PATCH priceT1/2/3 | listPrice + audit |
| Publish/unpublish | isPublished toggle | lifecycle + reason/impact |
| Create for teacher | POST admin courses | createdBy ≠ instructor |
| Teacher replacement | **MISSING** | Conflict-aware |
| Cancellation + 100% refund | **MISSING** | Required |
| Refunds | **MISSING** | Required |
| Students | list/block; extend Entitlement/Subscription separately | Enrollment-centric |
| Payments | list; demo counted as revenue | isDemo exclude |
| Live monitor | KPI live count | Full monitor |
| Incidents / System Health / Action Required | **MISSING** (tables empty Phase 1) | Required |
| Audit log | **MISSING** writers | Required |
| Security center | **MISSING** | Required |

**Files:** `admin/*`, `api/admin/*`, `admin-stats.ts`, `admin-courses.ts`.

---

## 9. LEGACY DEPENDENCY MATRIX

| Legacy | Files / routes (representative) | Purpose now | Target replacement | Phase | Temp OK? | Removal condition |
|--------|----------------------------------|-------------|-------------------|-------|----------|-------------------|
| TariffTier / T1–T3 | `tariffs.ts`, checkout, UI labels, notify minTier | Feature gates + prices | Enrollment + listPrice | 3–5, 15 | Yes | No tier reads in access/notify/UI |
| PLATFORM_PRICES | payments/demo, teacher-workspace, landing | Platform catalog | Course catalog prices | 3–5 | Yes | Tarif UI gone |
| priceT1/T2/T3 | Course model, admin boards, checkout | Triad price | listPrice | 3–4 | Yes | All checkout uses listPrice |
| Entitlement | access, onboard, payments/demo, admin entitlements API | Pay-then-pick-teacher | Purchase→Enrollment | 2–3, 15 | Yes | No writers; orphans handled |
| Subscription | access SoT, enroll, notify, cabinets | Course access window | Enrollment | 2–3, 15 | Yes | Dual-read off; backfill done |
| endsAt 30d | tariffs.isSubscriptionActive, demo pay addDays(30) | Expiry | accessOpen permanent policy | 2–3 | Yes | Access ignores endsAt |
| expire-other-subscriptions | `api/enroll/route.ts` | One active course | Multi-course | 3 + disable enroll | Yes until enroll off | `FF_DISABLE_ONBOARD_ENROLL` |
| TeacherPicker / onboard | `TeacherPicker.tsx`, `/onboard`, telegram links | Teacher select | Course attribute | 5 | Yes | Flag + remove routes |
| demo_paid | payments/demo, admin revenue | Demo ledger | isDemo + PAID semantics | 3 | Yes | Revenue excludes isDemo |
| isPublished | Course default true | Publish | lifecycleStatus | 4 | Yes | Catalog uses lifecycle |
| lobby | LessonStatus, liveGate mismatch | Waiting UI | waiting_room + signal | 7–8 | Yes | No lobby writers |
| Attendance page-open | learn upsert | Pseudo davomat | AttendanceInterval | 8 | Yes | Analytics cutover |
| `__tdyuLiveRooms` | live-rooms.ts | In-process SFU-less | Shared store | 8 | Yes | Shared rooms flag ON + soak |
| getLessonAccess / plan helpers | access.ts, plan.ts | Access + labels | Enrollment access module | 2+ | Yes | Call sites migrated |
| isBlocked single flag | auth login, admin block | Block all | purchaseAllowed + live security | 2+/security | Yes | Writers split |
| Public chat/uploads | chat GET, uploads/lessons | Convenience | Gated media | 7 | **Risky** | Secured routes live |
| Shorts | `/shorts` | Live feed | Future subsystem | — | Yes | Spec: separate future |

---

## 10. CUTOVER PLAN (reversible)

| Stage | What | Rollback |
|-------|------|----------|
| OLD | Phase 1 schema exists; flags OFF; CURRENT runtime | N/A |
| DUAL | Backfill Enrollment (approved); `FF_ENROLLMENT_ACCESS` ON dual-read | Flag OFF |
| DUAL commerce | `FF_COURSE_CHECKOUT_V2` writes Purchase+Enrollment; legacy demo still available or shadowed | Flag OFF |
| TARGET access | Enrollment-only read; stop writing Entitlement on new pays | Flag / code revert |
| LEGACY OFF | `FF_DISABLE_TARIFF_UI`, `FF_DISABLE_ONBOARD_ENROLL` | Flags OFF |
| LIVE/REC | Waiting + token + recording review flags one-by-one | Per-flag OFF |
| LEGACY DELETE | Drop Entitlement/Subscription/Tariff after soak + backup | Restore backup only |

**Never** delete published recordings/payments in auto jobs.

---

## 11. PHASE 2 READINESS

| Subsystem | Classification | Notes |
|-----------|----------------|-------|
| Prisma foundation (Purchase/Enrollment/…) | **READY FOR PHASE 2** | Empty tables; migrate applied locally |
| Feature flags module | **READY FOR PHASE 2** | All OFF; no call sites |
| Access dual-read design | **READY FOR PHASE 2** | Implement behind `FF_ENROLLMENT_ACCESS` only |
| Subscription→Enrollment backfill | **NEEDS DESIGN DECISION** | Apply only after non-empty dry-run on real data; permanent accessOpen vs endsAt mapping confirmed by spec (permanent) |
| Entitlement orphans | **LEGACY DEPENDENCY** | Must **not** auto-enroll (script already skips) |
| Commerce checkout v2 | **READY** for Phase 3 design; **BLOCKED** for enable until Phase 2 access dual proven | |
| Refunds | **BLOCKED** | No CURRENT code; needs Phase 10 + `FF_REFUNDS_V1` |
| Live waiting/signal | **LEGACY DEPENDENCY** | Broken lobby; Phase 7–8 |
| Recording review 24h | **BLOCKED** until Phase 9 | Entity unused |
| Public chat/materials | **LEGACY DEPENDENCY** / security risk | Fix with live/media phases |
| Teacher review/publish SM | **BLOCKED** until Phase 4 | No submit/review APIs |
| Admin Action Required / Health | **BLOCKED** until Phase 12 | Tables empty, no writers |
| Progress / course completion rules | **NEEDS DESIGN DECISION** | Spec: attendance ≠ completion; exact “lesson completed” counters still product-light — use Final Spec as-is (planned lessons finish by Teacher) |
| Certificate eligibility formula | **NEEDS DESIGN DECISION** | Spec: Teacher judgment + manual upload; no auto formula — OK |
| Shorts | **LEGACY DEPENDENCY** | Future subsystem; leave |
| Multi-course vs enroll expire | **READY** to kill via disable enroll after checkout v2 | Spec clear |

---

## 12. SPEC DELTAS / HIDDEN LEGACY / SECURITY / OPEN ARCH

### SPEC DELTA (deferred fields — not Phase 2 blockers)

- Course `learningOutcomes`
- Standalone Course Material entity
- NotificationDelivery table
- Join-token persistence store
- DB constraint “one live session per student”

### Hidden legacy dependencies

- `notifyCourseStudents(..., "t2")` silently skips t1 on live start
- Enroll forces `isPublished: true`
- Seed/demo paths may create Subscription without Entitlement (known)
- Telegram deep links still point to `/onboard` and `#tariflar`
- Admin revenue treats `demo_paid` as money
- `search/suggest` public
- Certificate issue without enrollment check; cert page any teacher

### Security / access risks (map only)

| ID | Risk | Severity |
|----|------|----------|
| S1 | Chat GET public | P0 |
| S2 | Lesson uploads public | P0 |
| S3 | Recordings under `public/` | P0 |
| S4 | Mux webhook unsigned | P0 |
| S5 | Stale JWT after block | P0 |
| S6 | Lobby UI vs live-only signal | P0 live UX/security confusion |
| S7 | No join token | P1 |
| S8 | endsAt vs permanent replay | P0 product/access |
| S9 | Enroll expires other courses | P0 product |

### Unresolved architectural decisions (spec-defined → no new product calls)

None blocking Phase 2 dual-read **if** Final Spec permanent `accessOpen` is followed for backfill (ignore legacy endsAt for accessOpen=true).

**Environment note:** Local validation DB was empty; production backfill dry-run still required before apply.

---

## 13. Exact file checklist for Phase 2 (access dual-read only)

When Phase 2 is authorized, touch **only** (expected):

- `src/lib/access.ts` (dual-read behind flag)
- Possibly thin helper `src/lib/enrollment-access.ts`
- Tests for dual-read
- **Not:** payments, enroll expire logic removal, frontend rewrite, live rewrite

Backfill: `scripts/phase1-backfill-enrollments.ts` dry-run on prod-like data first.

---

PRE-PHASE2 AUDIT COMPLETE — NO PHASE 2 CODE CHANGED.
