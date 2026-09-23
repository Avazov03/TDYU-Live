# PART 4 — Pricing / Subscription / Entitlement / Upgrade / Enrollment

This is the core product model.

## 4.1 Vocabulary — five different things

| Term | Table / code | Cardinality | Opens lessons? | Source of truth for… |
|------|--------------|-------------|----------------|----------------------|
| **TARIFF** | enum `TariffTier` + `src/lib/tariffs.ts` | catalog | no | feature flags (`canWatchLive` etc.) and **platform list prices** |
| **ENTITLEMENT** | `Entitlement` 1:1 User | one per user | **no** | “paid platform seat, may pick a teacher” |
| **SUBSCRIPTION** | `Subscription` unique (user, course) | many courses possible | **yes** (`getLessonAccess`) | lesson/chat/shorts/assignment access |
| **COURSE ACCESS** | same as Subscription | per course | yes | that course’s lessons |
| **USER ACCESS** | session + role + not used isBlocked after login | | | whether APIs accept the JWT |

[FACT]
File: prisma/schema.prisma
Model: Entitlement
Relevant code: `/** Platforma tarifi: to‘lovdan keyin o‘qituvchi tanlanadi. */` + `userId @unique`
Meaning: Entitlement is explicitly “pay first, pick teacher later”.

[FACT]
File: src/lib/access.ts
Function: `getLessonAccess`
Relevant code: looks up `subscription.findUnique({ userId_courseId })` only — **never reads Entitlement**
Meaning: **Subscription is source of truth for watching a lesson.** Entitlement alone cannot open `/learn`.

[FACT]
File: src/lib/access.ts
Function: `requireStudentCabinet`
Relevant code: if any active sub → enter; else if active entitlement → `/onboard`; else `/#tariflar`
Meaning: Cabinet source of truth is **any active Subscription**. Entitlement is an onboarding ticket.

If those two disagree (paid entitlement t3, leftover subscription t1), **the leftover subscription wins for lessons and for cabinet**.

## 4.2 Tariff catalog

[FACT]
File: src/lib/tariffs.ts
Constants: `PLATFORM_PRICES`, labels, features

| ID | UI short | UI long | Platform price | Duration in copy | Features array | Access helpers |
|----|----------|---------|----------------|------------------|----------------|----------------|
| `t1` | Yozuv | 1-tarif — Yozuv | 150_000 | 30 days (`addDays(now, 30)` in payment) | Yozib olingan darslar | live=false, chat=false, priority=false |
| `t2` | Jonli | 2-tarif — Jonli | 250_000 | 30 days | + Jonli efir + Efirda savol | live=true, chat=true |
| `t3` | Premium | 3-tarif — Premium | 400_000 | 30 days | + topshiriq birinchi + chat ustuvor | live=true, chat=true, `isPriorityTier` |

Currency: **so'm** via `formatSom` (`uz-UZ` locale + `" so'm"`). No USD.

`TARIFF_APP_HINTS.t1`: “Yozuvlar ochiq. Jonli efir, **Shorts va chat 2-tarifdan**.”

Roles: tariffs apply to **students**. Teachers/admins do not have Entitlement in the happy path.

## 4.3 Where tariff is defined vs checked

**Defined**
- Platform: `PLATFORM_PRICES` (`tariffs.ts`)
- Per course: `Course.priceT1/T2/T3` (admin edit, teacher create copies platform prices, seed can differ — seed c2 is 180/280/450k)
- Duration: hardcoded `addDays(now, 30)` in `payments/demo/route.ts`; checkout UI also `+ 30` days locally

**Checked**
- Live/lobby watch: `getLessonAccess` → `canWatchLive(sub.tier)`
- Chat POST: `canUseLiveChat` + access.ok; priority `isPriorityTier`
- Shorts page: `canWatchLive(sub.tier)` on **getAnyActiveSubscription** (one sub, latest endsAt)
- Sidebar shorts: `tariffTier === "t1"` hides link (tier from **same** any-active-sub)
- Teacher grade sort: `tierRank` t3 first
- Student assignments banner: `subs.some(isPriorityTier)`
- Live/lobby notifications: `notifyCourseStudents(..., "t2")` → t2 and t3 only
- Reminders: all active subs (no minTier)

**Pricing UI**
- Landing `#tariflar`: `PLATFORM_PRICES` (`src/app/page.tsx`)
- Course page: `course.priceT*` (`src/app/courses/[id]/page.tsx`)
- Checkout: whichever the page computed (`checkout/page.tsx`)

## 4.4 Payment write path (how entitlement/sub get created)

[FACT]
File: src/app/api/payments/demo/route.ts
Function: POST

1. Auth any logged-in user (not student-only).
2. Amount = `PLATFORM_PRICES[tier]` unless `courseId` → use that course’s `priceT*`.
3. `endsAt = addDays(now, 30)` always from **now** (does not extend remaining time).
4. Insert Payment `demo_paid`.
5. **Upsert Entitlement** `{ tier, startsAt: now, endsAt }` — **overwrites** previous tier/dates.
6. If `courseId` present: **upsert Subscription** for that course with same tier/dates.
7. If no courseId: **do not touch Subscription**.
8. JSON `{ next: courseId ? "app" : "onboard" }`.

No transaction wrapping payment + entitlement + subscription (three sequential awaits). If step 5/6 throws after payment insert, payment can exist without matching entitlement (caught, 500 to client).

## 4.5 Enrollment write path

[FACT]
File: src/app/api/enroll/route.ts
Function: POST
Input: `{ teacherId }` only — **not courseId**.

1. Must be student.
2. Must have **active Entitlement**.
3. Teacher must exist **and `teacher.userId` set** (“hali kabinet ochmagan” otherwise).
4. `ensureTeacherWorkspace(teacher.id)` → first course id (create if none) using `PLATFORM_PRICES`.
5. Force `course.isPublished = true`.
6. Find **other** subscriptions for this user with `endsAt > now` and **different courseId**; set `endsAt = now` (expire them).
7. Upsert subscription on workspace course: **copy entitlement.tier, startsAt, endsAt**.
8. Return `{ ok, courseId, teacherName, courseTitle }`.

Teacher picker UI: faculty chips then “Shu o'qituvchiga yozilish” (`TeacherPicker.tsx`).

Onboard page only lists teachers with `userId not null`.

## 4.6 Multiple courses / teachers

**Schema:** many Subscriptions per user (one per course).

**Enroll API:** at most **one active** subscription — others expired.

**Course checkout (`courseId` on demo pay):** does **not** expire others → **multiple active courses possible**.

[FACT]
File: src/app/app/page.tsx
Relevant code: `getActiveSubscriptions` then `{subs.length} ta kurs · {teachers} ta o'qituvchi`
Meaning: student dashboard is written for **N courses**. That matches course-checkout path, not enroll path.

[FACT]
File: src/lib/access.ts
Function: `getAnyActiveSubscription`
Relevant code: `findMany` orderBy endsAt desc, `find` first active
Meaning: landing, shell shorts lock, requireStudentCabinet “has a sub?” use **one** row (latest end date), not the union of tiers.

If user has t1 on course A (ends later) and t3 on course B (ends sooner), shorts lock uses A’s t1 → Shorts closed even though B is live-capable.

## 4.7 Upgrade / downgrade T1↔T2↔T3

There is **no** `/api/upgrade` and **no** proration. The only student write that changes tier is **demo payment upsert**.

For **platform checkout** (no courseId) — landing `/checkout?tier=`:

| Flow | Implemented? | What happens |
|------|----------------|--------------|
| T1→T2 | as re-pay | Entitlement overwritten to t2, new 30 days from now. **Existing Subscription.tier unchanged.** |
| T1→T3 | as re-pay | same |
| T2→T3 | as re-pay | same |
| T3→T2 | as re-pay | entitlement becomes t2; subs stay t3 until enroll/course-pay/admin |
| T3→T1 | as re-pay | same pattern |
| T2→T1 | as re-pay | same pattern |

### Step-by-step (all six are the same code path)

1. User clicks landing “Tanlash” / “Tarifni oshirish” (learn paywall) → `/#tariflar` or `/checkout?tier=tX`.
2. Route `/checkout`.
3. API `POST /api/payments/demo` `{ tier, provider }`.
4. DB: new Payment; Entitlement upsert; Subscription **untouched** if no courseId.
5. Entitlement: new tier + new 30-day window (does not add days to old end).
6. Subscription: **stays on old tier/end** unless they re-enroll or pay with courseId.
7. Course access: still old subscription.
8. Old subscription row: not deleted; unique key keeps it.
9. Payment: extra `demo_paid` row.
10. Effective immediately for entitlement; lessons still old sub.
11. UI success: “O‘qituvchi tanlash” (`next=onboard`) **if no active sub**; if they **still have** an active sub, `requireStudentCabinet` sends them to `/app` and **onboard redirects `/app`**, so they **cannot pick teacher** until sub expires. Checkout `next` is `onboard` but onboard will bounce to app.

[FACT]
File: src/app/onboard/page.tsx
Relevant code: `if (sub) redirect("/app")` before showing TeacherPicker
Meaning: **cannot switch teacher while any subscription is active**, even after paying a new entitlement.

### Course-scoped checkout `/checkout?tier=&courseId=`

Updates **that** course’s subscription tier/dates **and** entitlement. Does not expire other courses. Immediate lesson access change **for that course only**.

### Admin extend/cancel

- Entitlement extend/cancel does **not** write Subscription.
- Subscription extend/cancel does **not** write Entitlement.
- Cancel sets `endsAt = now` (active checks are `endsAt > now`, so immediately inactive).

## 4.8 Re-enrollment / switch teacher

Supported only when **no active subscription** (onboard) **or** by calling enroll API anyway:

Enroll API **will** expire other active subs even if UI never shows picker. Direct `POST /api/enroll` with a new teacherId while logged in as student with entitlement **is allowed** and expires others.

UI: no “boshqa o‘qituvchi tanlash” in cabinet. Copy on my-courses empty state: “Tarif to‘lab, onboardingda…”

Expired sub: user with expired sub and still-valid entitlement → `requireStudentCabinet` → `/onboard` (getAnyActiveSubscription fails, entitlement ok).

Expired entitlement + expired sub → `/#tariflar`.

## 4.9 “Student has Teacher A + Course A, then picks Teacher B”

**UI:** blocked while A subscription active (onboard redirect).

**If enroll API is called:** A’s subscription `endsAt=now`; B’s workspace course upserted with entitlement tier/dates. A row remains, inactive. Entitlement unchanged. Payments unchanged.

**If they pay course B via course page:** A stays active; B upserted; two active courses.

## 4.10 Feature vs tariff matrix (code)

| Feature | t1 | t2 | t3 | Checked in |
|---------|----|----|----|------------|
| Ended recording (playable) | yes if sub active | yes | yes | getLessonAccess allows ended regardless of live helper |
| scheduled lesson | all denied `not_started` | same | same | getLessonAccess |
| lobby / live MeetRoom | `live_locked` | yes if sub | yes | getLessonAccess + canWatchLive |
| Shorts | page EmptyGuide; nav hidden | yes | yes | shorts/page + Sidebar |
| Chat POST | 403 | yes | yes + priority flag | chat/route |
| Chat GET | **no auth** | | | anyone |
| Assignment submit | if sub | if sub | if sub | getActiveSubscription — **not** tier |
| T3 grade first | n/a | n/a | sort only | teacher/assignments/page `tierRank` |
| Certificate | teacher-issued | same | same | no tier check |
| Live start notify | not sent | sent | sent | minTier t2 |

Ended lesson with t1: access.ok true (status not live/lobby, not scheduled). Recording visible if file/mux exists.

## 4.11 Prices can diverge

Landing 150/250/400k. Teacher-created courses copy platform prices at creation time. Admin PATCH can set any ints ≥ 0. Seed course 2 is 180/280/450. Checkout with courseId uses course prices; without uses platform.

END OF PART 4
