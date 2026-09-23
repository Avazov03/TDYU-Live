# PART 7 — Student UX

## 7.1 Happy path (code)

```
Landing `/`
 → Register `/register` POST /api/auth/register
 → Login `/login` signIn credentials/Google → `/go` → resolveHomePath `/`
 → `#tariflar` CheckoutButton
 → `/checkout?tier=`
 → POST /api/payments/demo
 → Entitlement
 → `/onboard` TeacherPicker
 → POST /api/enroll
 → Subscription (others expired)
 → `/app` Bugun
 → `/schedule` or `/my-courses` → `/learn/[id]`
 → live MeetRoom or recording
 → `/assignments` SubmitForm POST /api/assignments/submit
 → teacher grades → notification
 → teacher POST /api/teacher/certificates
 → `/certificates` → `/certificates/[id]` print
 → when endsAt passed → requireStudentCabinet → `/#tariflar`  (renewal = same checkout)
```

Certificate and renewal have **no student self-service eligibility or upgrade wizard**.

## 7.2 Step table

| Stage | Screen | CTA | Required | API | DB | Next |
|-------|--------|-----|----------|-----|-----|------|
| Landing | `/` | Ro'yxat / Kirish / Tarif / O'qituvchi / Kabinet (session) | none | none | none | register/login/#tariflar/onboard/app |
| Register | `/register` | submit | name≥2, email, password≥8 | POST `/api/auth/register` | User student | login (form) |
| Login | `/login` | Kirish / Google | email or `avazov` alias | NextAuth | lastLoginAt | `/go` |
| Home resolve | `/go` | — | session | — | read sub/entitlement | admin/teacher/app/onboard/`/` |
| Forgot | `/forgot-password` | | email | POST forgot-password | reset token | email / devResetUrl |
| Reset | `/reset-password?token=` | | token, pw≥8 | POST reset-password | hash, usedAt | login |
| Tariff | `/#tariflar` | Tanlash | — | — | — | `/checkout?tier=` |
| Checkout | `/checkout` | Davom / to'lash | login, tier | POST payments/demo | Payment, Entitlement, maybe Sub | onboard or app |
| Onboard | `/onboard` | Shu o'qituvchiga yozilish | student, entitlement, no active sub | POST enroll | sub upsert, expire others | `/app` |
| Bugun | `/app` | Kirish/Davom/Ochish | active sub | SSR prisma | attendance read | learn/assignments/schedule |
| Kurslarim | `/my-courses` | row → `/courses/[id]` | cabinet | SSR all subs | — | course |
| Course | `/courses/[id]` | Tarif or Bugunga; lesson Ochish | published course | — | — | checkout or learn |
| Schedule | `/schedule` | lesson | cabinet | — | — | learn |
| Learn | `/learn/[id]` | prev/next, Tarifni oshirish, chat | access.ok for media | attendance upsert; chat; signal | Attendance | playlist |
| Shorts | `/shorts` | swipe live | t2/t3 any-sub | — | — | Meet? feed component |
| History | `/history` | lesson | requireAppUser | — | attendance | learn |
| Assignments | `/assignments` | yuborish | cabinet | POST submit | Submission | refresh |
| Certificates | `/certificates` | Ochish | cabinet | — | Certificate | print page |
| Search | `/search?q=` | Ochish course | requireAppUser | suggest GET public | courses | `/courses/[id]` |
| Settings | `/settings` | telegram save | login | PATCH settings/telegram | telegramChatId | — |
| Legal | `/privacy` `/terms` | | public | — | — | — |

## 7.3 Screen notes

**Landing CTA logic** (`page.tsx`): sub → Kabinet; else entitlement → O'qituvchi tanlash; else logged-in → Tarif tanlash; else register+login.

If sub exists, tarif section is **not** the pricing grid — it shows “TARIFF_LABELS[sub.tier] faol” + teacher/course from **getAnyActiveSubscription** only.

**Bugun `/app`:** live list (all active course ids), continue from last attendance, due assignments (unsubmitted, dueAt≥now), upcoming scheduled next 7 days take 4. EmptyGuide if all empty.

t1 live rows still link Kirish with badge “Yozuvdan keyin”.

**Learn paywall messages** (`accessMessage`): login / yozilmagansiz / muddat tugagan / jonli 2-3 tarif / hali boshlanmagan.

**Assignments:** filters open/late/done. Submit allowed even if late (**no dueAt check**). T3 banner: “3-tarifdagi ishingiz o'qituvchida birinchi navbatda.”

**History title:** “Ochgan darslaringiz” = attendance, not play time.

**Shorts:** students filtered to subscribed courses’ live lessons; teachers/admins see all published live (`requireAppUser` staff bypass).

## 7.4 Component map (student)

```
/ (page.tsx)
  SiteHeader (LexifyNotchNavbar)
  HeroSparkles
  PricingWithHeaderAndIcons → CheckoutButton
  SiteFooter

/checkout → CheckoutClient → POST /api/payments/demo

/onboard → TeacherPicker → POST /api/enroll

/app → AppShell → Sidebar + Topbar (SearchBar, NotificationBell)
  live/upcoming/due/lastSeen links

/my-courses → MyCoursesBoard (filters) → /courses/[id]

/learn/[id] → MeetRoom | video | paywall
  WatchShareButton, LessonRow playlist, LiveChat (ended only)

/assignments → AssignmentsBoard → SubmitForm

/history → HistoryBoard

/shorts → LiveShortsFeed

/search → course links
  SearchBar → GET /api/search/suggest (250ms debounce) + localStorage ot-search-history
```

## 7.5 Journey failure points (user questions)

| Question | Does the product answer? | Where it breaks |
|----------|--------------------------|-----------------|
| Nimani sotib olyapman? | Landing: platform tariff 30 kun. Course page: that course’s prices | Two different products (platform vs course) |
| Qaysi kursga access? | After enroll: one workspace course of teacher (often subject name). After course checkout: that course | Enroll does not let student pick among teacher’s many courses — **first course** from findFirst |
| Qaysi teacher meniki? | Onboard picker; landing status uses any-sub teacher | Multiple subs: landing shows one |
| Qaysi tarifdaman? | Landing if sub; Bugun does **not** show tier; my-courses shows TARIFF_LABELS; shell uses any-sub | Entitlement vs sub can differ |
| Qachon tugaydi? | Checkout receipt; course page if sub; my-courses nextLabel is **next lesson** not endsAt | endsAt not on /app |
| Qanday upgrade? | Learn paywall “Tarifni oshirish” → landing; no in-app upgrade that syncs sub | entitlement updates, sub may not |
| Upgrade qaysi coursega? | Unspecified in UI | |
| Qaysi darsga kira olaman? | Schedule lists all; learn enforces | scheduled always locked |
| Nega kira olmayapman? | paywall reason strings | lobby signal 403 not explained |
| Boshlanmaganmi yoki tarif yetmayaptimi? | distinct reasons not_started vs live_locked | /app still links both |
| Darsni ko‘rganmanmi? | History = opened page | not watch % |
| Live qatnashganmanmi? | same attendance | lobby open counts |
| Necha foiz tugatdim? | learn % is yozuv tayyor | mislabeled progress |
| Boshqa teacher? | only after sub expired, via onboard | enroll API can switch |
| Bir nechta kurs? | dashboard N kurs; enroll forbids; course pay allows | |
| Payment keyin access qachon? | immediately entitlement; lessons after enroll or courseId pay | |

END OF PART 7
