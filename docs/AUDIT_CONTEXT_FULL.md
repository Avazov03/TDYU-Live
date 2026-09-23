# Lexify — COMPLETE PROJECT CONTEXT + BUSINESS LOGIC + UX FLOW + ACCESS MODEL + TECHNICAL ARCHITECTURE + EVIDENCE

**Extracted:** 2026-09-22
**Repo:** D:/SCP loyhalar/TSUL Live
**Note:** This single file concatenates the full audit pack without shortening. Source code was not modified.

---


==================================================
SOURCE FILE: docs\audit\README.md
==================================================

# Lexify — Audit context (read-only extraction)

**Extracted:** 2026-09-22
**Repo:** `D:/SCP loyhalar/TSUL Live` (`git@github.com:Avazov03/TDYU-Live.git`, remote **manba**, branch **main**)
**Constraint:** no source code was modified. This folder is the only new output.

This pack is for a senior full-stack / UX / PM / QA audit. It is **context + evidence**, not a fix list.

## How to read

| File | Contents |
|------|----------|
| [01-architecture.md](./01-architecture.md) | Repository inventory, stack, env, deploy, libraries |
| [02-database.md](./02-database.md) | Prisma schema, entities, relations, consistency risks |
| [03-roles-permissions.md](./03-roles-permissions.md) | Roles, routes, APIs, UI nav vs server checks |
| [04-pricing-access.md](./04-pricing-access.md) | Tariff, entitlement, subscription, upgrade, enrollment |
| [05-payment.md](./05-payment.md) | Checkout, demo payment, providers, revenue metrics |
| [06-course-lesson-live.md](./06-course-lesson-live.md) | Course/lesson lifecycle, live, recording, attendance, progress |
| [07-student-ux.md](./07-student-ux.md) | Student journey, screens, CTAs, APIs |
| [08-teacher-ux.md](./08-teacher-ux.md) | Teacher studio journey |
| [09-admin-ux.md](./09-admin-ux.md) | Admin dashboard, metrics formulas |
| [10-api-routes.md](./10-api-routes.md) | Page routes + API inventory |
| [11-security-performance.md](./11-security-performance.md) | Security, performance, a11y, mobile, notifications, search |
| [12-contradictions-edge-cases.md](./12-contradictions-edge-cases.md) | Contradictions, edge cases, docs vs code |
| [13-final-handoff.md](./13-final-handoff.md) | Product map, business rules, findings, files to inspect |

Each PART ends with `END OF PART N`.

## Evidence rule used

Every important claim uses:

```
[FACT]
File:
Function/component:
Relevant code:
Meaning:
```

If the repository does not prove something: **UNKNOWN** or **ANIQLANMADI**.
If two places disagree: both are listed.

## Product one-liner (from code, not marketing)

Lexify is a **paid live-lesson + recording LMS** for TDYU law courses. A student pays a **platform tariff** (30 days), then picks **one teacher** (enroll path), which creates a **course subscription**. Lesson access is checked on **Subscription.tier + endsAt**, not on Entitlement. Live video is **in-process WebRTC** (`/api/live/signal`) with optional **Mux RTMP/VOD**. All checkout currently writes **demo_paid** payments.

## Known extraction gaps

- Git commit messages for the last 30–50 commits: **not dumped in this pack** (tooling in this session did not return `git log`). Migration names in `prisma/migrations/` are used instead.
- Production runtime (PM2 cluster size, whether Mux/Telegram/Resend are set): **UNKNOWN**.
- Mobile visual layout: **UNKNOWN** (no screenshots in this extraction). Code breakpoints are listed.
- Real Payme/Click production keys: **not present in repo**. Integration is demo-only in code.


==================================================
SOURCE FILE: docs\audit\01-architecture.md
==================================================

# PART 1 — Architecture & Repository

## 1.1 Project identity

| Item | Value | Source |
|------|--------|--------|
| npm name | `lexify` `0.1.0` private | `package.json` |
| Brand | Lexify / Lx / “Jonli dars va kurslar” | `src/lib/brand.ts` |
| Local | `http://localhost:3000` | `README.md`, `.env.example` |
| Production domain (docs) | `https://lexify.zonic.fit` | `.cursor/rules/lexify.mdc` |
| GitHub | `git@github.com:Avazov03/TDYU-Live.git` remote **manba** | `lexify.mdc` |
| App folder on server (docs) | `/var/www/tdyu-live`, PM2 `tdyu-live`, port 3100 | `lexify.mdc`, `SETUP.md` |
| Public IPv4 (rules) | `3.65.92.39` | `lexify.mdc` |
| Public IPv4 (SETUP.md) | `3.79.57.253` | `SETUP.md` line 79 |
| Not this project | `https://open.okina.uz`, `72.62.3.191` | AGENTS.md / rules |

[FACT]
File: SETUP.md
Function/component: Production section
Relevant code: `Domen: **https://lexify.zonic.fit** (server \`3.79.57.253\`).`
Meaning: SETUP.md and Cursor rules disagree on production IPv4. Which IP is currently live is UNKNOWN from this repo alone.

## 1.2 Directory map (as scanned)

```
TSUL Live/
  package.json, package-lock.json, tsconfig.json, next.config.ts
  prisma.config.ts
  prisma/schema.prisma
  prisma/seed.ts
  prisma/migrations/
    20260324120000_init
    20260909100000_lms_pivot          ← YouTube-clone tables dropped, LMS created
    20260914120000_lesson_plan_fields
    20260916100000_password_reset_tokens
    20260918120000_lesson_lobby
  docker-compose.yml                  ← postgres:16 + redis:7, names still "opentsul-*"
  playwright.config.ts
  e2e/landing.spec.ts
  DESIGN.md, README.md, SETUP.md, TDYU_Live_TZ.md, AGENTS.md, CLAUDE.md
  scripts/  (admin create, telegram poll, wipe-demo, check-*)
  public/uploads/{assignments,lessons,recordings}/
  src/app/          Next.js App Router pages + API
  src/components/   UI
  src/lib/          business logic
  src/types/        next-auth.d.ts
  src/generated/prisma/  (gitignored, prisma generate)
```

No `src/middleware.ts`, no `src/proxy.ts`, no `src/i18n/`.

## 1.3 Framework / language / package manager / build

[FACT]
File: package.json
Function/component: scripts + dependencies
Relevant code:
```
"dev": "next dev", "build": "next build", "start": "next start"
"next": "16.2.9", "react": "19.2.4", "typescript": "^5"
```
Meaning: Next.js 16 App Router + React 19 + TypeScript. Package manager is **npm** (`package-lock.json` present; no pnpm/yarn lock).

[FACT]
File: next.config.ts
Relevant code: empty `NextConfig` object
Meaning: no custom images/rewrites/headers/experimental flags in repo.

[FACT]
File: src/app/layout.tsx
Relevant code: root layout wraps ThemeProvider + SessionProvider; `lang="uz"`
Meaning: server/client hybrid; session is JWT via NextAuth (see 1.8).

Most LMS pages set `export const dynamic = "force-dynamic"` (no static cache).

## 1.4 Database / ORM

[FACT]
File: prisma/schema.prisma
Relevant code: `datasource db { provider = "postgresql" }` + Prisma 7 `generator client { output = "../src/generated/prisma" }`
Meaning: PostgreSQL. Client is generated into `src/generated/prisma` (gitignored).

[FACT]
File: src/lib/prisma.ts
Function: `createPrismaClient`
Relevant code: `PrismaPg` adapter + `pg.Pool`; lazy Proxy so `DATABASE_URL` can load after process start
Meaning: Prisma 7 driver adapter, not the old Prisma engine URL-only client.

[FACT]
File: prisma.config.ts
Relevant code: `datasource.url: process.env["DATABASE_URL"]`
Meaning: Prisma 7 config file; migrations path `prisma/migrations`.

Docker Compose still uses DB name **opentsul** (`POSTGRES_DB: opentsul`). `.env.example` same. Product brand is Lexify; DB identifier was not renamed in compose.

Redis is in `docker-compose.yml`. `.env.example` says Redis is unused. Grep of `src/` shows **no Redis client**.

## 1.5 Authentication

[FACT]
File: src/lib/auth.ts
Function: NextAuth config
Relevant code: `session: { strategy: "jwt" }`; providers: optional Google + Credentials; `trustHost: true`; `pages.signIn: "/login"`
Meaning: Auth is NextAuth v5 (`next-auth@5.0.0-beta.31`). Session is JWT, not DB sessions.

Credentials: email/password via bcrypt (`src/lib/password.ts`, 12 rounds). Also HMAC tickets for admin impersonation (`src/lib/impersonate.ts`).

Google: only if `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are both set (`isGoogleAuthEnabled`).

Blocked users are rejected at **sign-in** (`isBlocked`). JWT is not re-checked against `isBlocked` on later requests (no jwt callback DB lookup). A user blocked after login keeps a valid JWT until it expires. JWT maxAge is NextAuth default (**UNKNOWN exact seconds** — not overridden in this file).

Route: `src/app/api/auth/[...nextauth]/route.ts` exports `handlers` GET/POST.

No project `middleware.ts` → **no global cookie gate**. Each page/API checks `auth()` itself.

## 1.6 Authorization

[FACT]
File: src/lib/roles.ts
Relevant code: `isAdminRole` / `isTeacherRole` / `isStudentRole` compare to `"admin" | "teacher" | "student"`
Meaning: three DB roles. No `superadmin` enum.

[FACT]
File: src/lib/super-admin.ts
Function: `superAdminEmails` / `viewerCanSeeCredentials`
Relevant code: env `SUPER_ADMIN_EMAIL` CSV, default `"avazov@tdyu.live"`; must also be `role === "admin"`
Meaning: Super-admin is an **email allowlist**, not a role. Used to show/reset passwords.

[FACT]
File: src/lib/auth.ts
Function: `requireRole`
Relevant code: defined, **never called** by pages/APIs (scan)
Meaning: unused helper. Real checks are inline `auth()` + role string.

Access for students: `src/lib/access.ts` (`requireStudentCabinet`, `requireAppUser`, `getLessonAccess`).

## 1.7 Payment

[FACT]
File: src/app/api/payments/demo/route.ts
Meaning: **only payment API**. Always inserts `status: "demo_paid"`. Accepts `provider: demo | payme | click` as a **label**, not a gateway call.

No `/api/payments/payme`, no `/api/payments/click`, no Payme/Click webhook routes.

Checkout UI: `src/components/course/CheckoutClient.tsx` still shows Payme and Click buttons, all posting to `/api/payments/demo`.

## 1.8 Video / live streaming

| Piece | Where | What |
|-------|--------|------|
| Mux live create | `src/lib/mux.ts` `createLiveStream` | POST `https://api.mux.com/video/v1/live-streams` if tokens set |
| Mux demo fallback | same, `demoLiveStream` | ids prefixed `demo_` |
| Mux complete | `completeLiveStream` | PUT `.../live-streams/{id}/complete` |
| Mux player URL | `src/lib/mux-player.ts` | `https://player.mux.com/{playbackId}` |
| Mux webhook | `src/app/api/mux/webhook/route.ts` | `video.asset.ready` → lesson `ended` + VOD id. **No signature verify** |
| In-app live | `src/lib/live-rooms.ts` + `src/app/api/live/signal/route.ts` | in-memory WebRTC signaling (offer/answer/ice) |
| Meet UI | `src/components/live/MeetRoom.tsx` | STUN only (Google + Cloudflare). MediaRecorder webm |
| Local recording | `POST /api/teacher/lessons/[id]/recording` | writes `public/uploads/recordings/*.webm` |
| Playback gate | `GET /api/media/recording/[id]` | auth + lesson access |

**LiveKit is not a dependency** and is not imported.

[FACT]
File: src/app/api/live/signal/route.ts
Function: `liveGate`
Relevant code: `if (!lesson || lesson.status !== "live") return { ok: false, moderator: false };`
Meaning: signaling is allowed **only when lesson.status === "live"**. Lobby MeetRoom UI exists but this API rejects lobby (see PART 6 / 12).

## 1.9 File / storage

Local disk under `public/uploads/`:

| Path | Writer | Reader |
|------|--------|--------|
| `public/uploads/assignments/` | `POST /api/assignments/submit` | URL `/uploads/assignments/...` (static public) |
| `public/uploads/lessons/` | `POST /api/teacher/lessons/[id]/assets` | `GET /uploads/lessons/[filename]` (custom route, **no auth**, CORS `*`) |
| `public/uploads/recordings/` | `POST /api/teacher/lessons/[id]/recording` | intended `GET /api/media/recording/[id]` (auth). Files still sit under `public/` |

.gitignore ignores uploaded blobs, keeps `.gitkeep`.

## 1.10 Email

[FACT]
File: src/lib/email.ts
Function: `sendEmail`
Relevant code: Resend HTTP API if `RESEND_API_KEY`; else skip + log
Meaning: password reset + notification emails. No other mailer.

## 1.11 Telegram

| File | Role |
|------|------|
| `src/lib/telegram/api.ts` | Bot API helper; `TELEGRAM_BOT_TOKEN` |
| `src/lib/telegram/bot.ts` | commands: home/help/status/today/courses/unlink + deep-link `start=u_{userId}` |
| `src/lib/telegram/poll.ts` | `getUpdates` long-poll; deletes webhook first |
| `src/lib/telegram/context.ts` | bot copy for student/teacher/admin |
| `src/app/api/telegram/webhook/route.ts` | optional `TELEGRAM_WEBHOOK_SECRET` header |
| `src/app/api/cron/telegram-poll/route.ts` | short poll; if `CRON_SECRET` unset, **no auth** |
| `scripts/telegram-poll.ts` | `npm run bot:telegram` PM2-style loop |
| `PATCH /api/settings/telegram` | user saves `telegramChatId` |

Comment in webhook: primary channel is PM2 polling, not webhook.

## 1.12 Analytics

No Google Analytics / Mixpanel / Posthog in `package.json` or `src/`.

Admin metrics are Prisma aggregations: `src/lib/admin-stats.ts`, `src/lib/admin-courses.ts`.

## 1.13 Notifications

In-app `Notification` rows + optional Telegram + email (`src/lib/notify.ts`). Types in schema: `lesson_starting`, `lesson_live`, `assignment`, `grade`, `certificate`, `system`.

Triggers: lesson create/lobby/start/end, mux VOD ready, assignment, grade, certificate, admin teacher invite, cabinet open reminder (`maybeSendLessonReminders`).

## 1.14 Cron / jobs

| Endpoint | Auth | Job |
|----------|------|-----|
| `GET /api/cron/lesson-reminders` | `CRON_SECRET` required (503 if missing) | `sendUpcomingLessonReminders` |
| `GET /api/cron/telegram-poll` | `CRON_SECRET` **if set**; if unset, open | `pollTelegramOnce` |
| Student AppShell load | none extra | `maybeSendLessonReminders(userId)` |

No `node-cron` package. External scheduler is UNKNOWN (server crontab? PM2?).

## 1.15 External APIs

- Google OAuth (NextAuth)
- Resend (`api.resend.com/emails`)
- Mux Video API + Mux player CDN + `image.mux.com` thumbnails
- Telegram Bot API
- WebRTC STUN: `stun.l.google.com`, `stun.cloudflare.com`
- **Not present:** Payme, Click, LiveKit, Redis client, S3/R2

## 1.16 Deployment / Docker

- Docker Compose: Postgres 16 + Redis 7, container names `opentsul-postgres` / `opentsul-redis`. **No app Dockerfile** in repo scan.
- Production: docs say PM2 `tdyu-live` on Lightsail. Deploy scripts are gitignored (`scripts/deploy*.py`). Actual deploy procedure in-repo: **ANIQLANMADI** beyond SETUP.md admin create command.
- E2E: Playwright Chromium, `e2e/landing.spec.ts` only (hero + navbar).

## 1.17 Environment variables

From `.env.example` + code usages:

| Variable | Used in | Required? |
|----------|---------|-----------|
| `DATABASE_URL` | prisma, prisma.ts | yes |
| `AUTH_SECRET` | NextAuth, impersonate HMAC (fallback `"dev-only-change-me"`) | prod yes |
| `AUTH_URL` / `NEXTAUTH_URL` | NextAuth, invite URLs, email reset, telegram siteBaseUrl | yes |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google provider | optional |
| `RESEND_API_KEY` / `EMAIL_FROM` | email.ts | optional |
| `SUPER_ADMIN_EMAIL` | super-admin.ts | optional, default avazov@tdyu.live |
| `ALLOW_SEED` | mentioned in example; seed actually blocks on `NODE_ENV === "production"` | |
| `REDIS_URL` | example only, unused | |
| `MUX_TOKEN_ID` / `MUX_TOKEN_SECRET` | mux.ts | optional; prod throws if missing when creating real stream |
| `TELEGRAM_BOT_TOKEN` | telegram | optional |
| `TELEGRAM_WEBHOOK_SECRET` | webhook | optional |
| `CRON_SECRET` | cron routes | required for lesson-reminders; optional for telegram-poll |
| `NEXT_PUBLIC_SITE_URL` | telegram `siteBaseUrl` fallback | optional |
| `NODE_ENV` | seed block, mux demo, forgot-password dev URL | |

`CRON_SECRET` is **not listed** in `.env.example`. `TELEGRAM_WEBHOOK_SECRET` is **not listed** there either.

## 1.18 Middleware / server-client split

- **No Next.js middleware.**
- Server Components: almost all `page.tsx` files (Prisma queries, `auth()`, redirects).
- Client: forms, checkout, MeetRoom, Sidebar, AdminShell, SearchBar, boards with filters, LiveStudio, TeacherPicker.

[FACT]
File: src/app/teacher/layout.tsx
Relevant code: pass-through `{children}` only
Meaning: teacher auth is **per page**, not layout. Admin **does** gate in `src/app/admin/layout.tsx`.

## 1.19 Major libraries (where used)

| Library | Where |
|---------|--------|
| next 16.2.9 | app router |
| react 19 | UI |
| next-auth 5 beta | `src/lib/auth.ts` |
| prisma 7 + @prisma/adapter-pg + pg | DB |
| bcryptjs | passwords |
| zod 4 | API validation |
| lucide-react | icons (sidebar, checkout) |
| framer-motion | aceternity sidebar / timeline / auth shell |
| clsx + tailwind-merge | `src/lib/utils.ts` `cn()` |
| @tsparticles/* | `src/components/ui/sparkles.tsx` (HeroSparkles) |
| dotenv | prisma.config, seed, scripts |
| tailwindcss 4 | `src/app/globals.css` via `@tailwindcss/postcss` |
| playwright | e2e |

UI ports (from `.cursor/rules/ui-library-port.mdc` + files): Aceternity sidebar/timeline/login-gradient, Magic UI theme toggler, Vengeance notch navbar / particles / stagger (HeroSparkles, LexifyNotchNavbar).

## 1.20 Historical remnant (product rename)

Evidence the product was previously a YouTube-like / “Open Tsul” / “TDYU Live” app:

- Migration `20260909100000_lms_pivot`: drops `videos`, `shorts`, `playlists`, `watch_history`, `comments`, `reactions`, …
- Docker/DB names still `opentsul`
- localStorage keys `ot-theme`, `ot-search-history`
- Repo name `TDYU-Live`
- `LessonStatus` originally had no `lobby` (added `20260918120000_lesson_lobby`)

END OF PART 1


==================================================
SOURCE FILE: docs\audit\02-database.md
==================================================

# PART 2 — Database & Entities

Source of truth: `prisma/schema.prisma` (PostgreSQL, Prisma 7).

## 2.1 Enums

| Enum | Values | Notes |
|------|--------|--------|
| `UserRole` | `student`, `teacher`, `admin` | default student |
| `Language` | `uz`, `ru`, `en` | default `uz`; UI is hardcoded Uzbek |
| `Theme` | `dark`, `light` | default `dark`; actual theme also in localStorage `ot-theme` |
| `TariffTier` | `t1`, `t2`, `t3` | no names in DB |
| `LessonStatus` | `scheduled`, `lobby`, `live`, `ended` | **no** cancelled / recording / archived |
| `PaymentStatus` | `demo_paid`, `pending`, `paid`, `failed` | **no** refund / cancelled / expired |
| `PaymentProvider` | `demo`, `payme`, `click` | |
| `NotificationType` | `lesson_starting`, `lesson_live`, `assignment`, `grade`, `certificate`, `system` | |

## 2.2 Models (fields)

### User (`users`)

| Field | Type | Notes |
|-------|------|--------|
| id | uuid pk | |
| fullName | string | |
| email | string unique | stored lowercased on register/invite |
| passwordHash | string? | Google-only users can be null |
| googleId | string? | |
| role | UserRole | default student |
| avatarUrl | string? | |
| language | Language | default uz |
| theme | Theme | default dark; settings form does not persist theme to DB (client localStorage) |
| isBlocked | boolean | default false |
| lastLoginAt | DateTime? | set on credentials + Google sign-in |
| telegramChatId | string? | |
| createdAt | DateTime | |

Relations: teacherProfile?, entitlement?, subscriptions[], payments[], attendance[], submissions[], certificates[], notifications[], chatMessages[], passwordResetTokens[].

**Who creates:** register API (student), Google sync (student), invite accept (teacher), admin create-admin script, seed.
**Who updates:** self (telegram chat id, not name/email/password — settings copy says “keyingi yangilanishda”), admin block/reset, auth lastLogin.
**Who sees:** self via session; admin student list; teacher sees enrolled students (name/email) on group board.

### PasswordResetToken

id, userId (cascade), tokenHash unique, expiresAt, usedAt?, createdAt. Index userId.

### Faculty (`faculties`)

id, nameUz, nameRu, nameEn, order default 0.
Relations: subjects[], courses[], teachers[].
Created in seed; **no admin API to CRUD faculties** found.

### Subject (`subjects`)

id, facultyId cascade, nameUz/Ru/En.
Created in seed; **no admin API to CRUD subjects** found. Admin teacher create requires existing facultyId/subjectId.

### Teacher (`teachers`)

| Field | Type | Notes |
|-------|------|--------|
| id | uuid | |
| userId | string? unique | null until invite accepted / ensureTeacherUser |
| facultyId, subjectId | required, cascade delete | |
| fullName, contactEmail | string | |
| createdAt | | |

Relations: user?, faculty, subject, courses[], invites[].

**Important:** Teacher is a **profile row**, not the same as User. A User with role teacher may have no Teacher profile (UI: “Admin sizni fan bilan bog'lagach…”).

### TeacherInvite

id, teacherId cascade, token unique, expiresAt (default 14 days via `inviteExpiresAt`), usedAt?, createdAt.

### Course (`courses`)

| Field | Type | Notes |
|-------|------|--------|
| id | uuid | |
| teacherId, facultyId, subjectId | required, **onDelete Cascade** | deleting teacher/faculty/subject deletes courses |
| titleUz, descriptionUz | | **no titleRu/titleEn** despite faculty/subject i18n |
| priceT1, priceT2, priceT3 | Int | so'm integers |
| isPublished | Boolean default **true** | only publish flag; **no draft/paused/ended/archived enum** |
| createdAt | | |

Relations: lessons[], subscriptions[], payments[], assignments[], certificates[].

**Lifecycle statuses draft/active/paused/ended/archived: NOT IN SCHEMA.** Only `isPublished`.

### Subscription (`subscriptions`)

id, userId cascade, courseId cascade, tier, startsAt, endsAt, createdAt.
**`@@unique([userId, courseId])`** — one row per user per course (upsert, not history of periods).

### Entitlement (`entitlements`)

Comment in schema: `Platforma tarifi: to‘lovdan keyin o‘qituvchi tanlanadi.`
id, **userId unique**, tier, startsAt, endsAt, createdAt.
One platform tariff per user. Not tied to a course.

### Lesson (`lessons`)

id, courseId (index, cascade), titleUz, summaryUz?, coverUrl?, scheduledAt, status default scheduled, muxLiveStreamId?, muxLivePlaybackId?, muxVodPlaybackId?, streamKey?, recordingUrl?, createdAt.

**No** duration, no cancelled, no actualStart/actualEnd timestamps.

### LessonAsset

id, lessonId, fileName, fileUrl, mime, createdAt.

### Attendance (`attendance`)

id, userId, lessonId, **joinedAt default now()**.
**Only field is joinedAt.** No leftAt, no duration, no status enum.
`@@unique([userId, lessonId])`.

### Assignment

id, courseId cascade, lessonId? SetNull, titleUz, descriptionUz, dueAt, createdAt.

### Submission

id, assignmentId, userId, text?, fileName?, fileUrl?, grade Int?, teacherNote?, createdAt, gradedAt?.
`@@unique([assignmentId, userId])`. Grade 0–100 enforced in API zod, not DB check.

### Certificate

id, userId, courseId, issuedAt default now, issuedBy? (stores user id of issuer).
`@@unique([userId, courseId])`. **No eligibility fields.**

### Payment

id, userId cascade, courseId? SetNull, tier, amount Int, status default **demo_paid**, provider default **demo**, createdAt.
**No unique constraint** — duplicate payments allowed.
**No** external transaction id, no webhook payload, no refundedAt.

### Notification

id, userId, type, titleUz, messageUz, relatedId?, isRead default false, createdAt. Index `[userId, isRead]`.

### ChatMessage

id, lessonId, userId, text, priority Boolean default false, createdAt. Index `[lessonId, createdAt]`.

### SiteSetting

id, key unique, value text.
Seed deletes this table. **No application reads found in the scanned API/pages** (ANIQLANMADI / unused in src app flow).

## 2.3 Entity meanings (product)

### User
Account. Role discriminates student/teacher/admin. Not every teacher User has a Teacher row.

### Student
Not a table. `User.role === "student"`. Access via Entitlement then Subscription.

### Teacher
`Teacher` row + optional linked `User`. Admin creates Teacher first; invite creates/links User.

### Admin
`User.role === "admin"`. Super-admin is email allowlist.

### Course
Teacher workspace unit. Auto-created by `ensureTeacherWorkspace` as `{subject.nameUz}` if teacher has zero courses. Teachers can create more via `POST /api/teacher/courses`. Admin can create/edit via admin APIs.

### Lesson
Scheduled event on a course. Status machine: scheduled → lobby → live → ended.

### Live session
Not a table. A Lesson with `status` lobby or live + in-memory room in `globalThis.__tdyuLiveRooms`.

### Recording
Not a table. `Lesson.recordingUrl` (local file) and/or `muxVodPlaybackId`.

### Assignment / Submission / Certificate
As models above. Certificate is **manual teacher action**, not auto from progress.

### Tariff
Not a table. Enum `TariffTier` + constants in `src/lib/tariffs.ts`. Course has three price ints. Platform has `PLATFORM_PRICES`.

### Entitlement
Paid platform seat (30 days, one per user). Does **not** open lessons by itself.

### Subscription
Course access row (tier + window). **This is what `getLessonAccess` reads.**

### Payment
Ledger row. Created only by demo checkout in app code (plus seed).

### Attendance
“Opened learn page while lesson was lobby/live/ended and access.ok”. Not live-join telemetry.

### Progress
**No Progress model.** UI percentages are computed (see PART 6).

### Notification / Invite / Faculty / Subject
As models.

### Course plan
Not a table. Teacher form `CreateCoursePlanForm` → one Course + N Lessons.

### Schedule
Not a table. Query of Lessons for subscribed courseIds.

### Chat
`ChatMessage` persisted (used on ended learn page) **and** in-memory live chat in `live-rooms.ts` (MeetRoom). Two chat systems.

### Shorts
Not a table. `/shorts` lists `Lesson status=live`.

## 2.4 ER diagram (text)

```
User
 ├── Teacher? (1:1 via Teacher.userId)
 ├── Entitlement? (1:1)
 ├── Subscription[] (N:1 Course; unique userId+courseId)
 ├── Payment[]
 ├── Attendance[] ── Lesson
 ├── Submission[] ── Assignment
 ├── Certificate[] ── Course
 ├── Notification[]
 ├── ChatMessage[] ── Lesson
 └── PasswordResetToken[]

Faculty
 ├── Subject[]
 ├── Teacher[]
 └── Course[]

Subject
 ├── Teacher[]
 └── Course[]

Teacher
 ├── User?
 ├── Faculty, Subject
 ├── TeacherInvite[]
 └── Course[]
      ├── Lesson[]
      │    ├── Attendance[]
      │    ├── Assignment[]? (optional lessonId)
      │    ├── ChatMessage[]
      │    └── LessonAsset[]
      ├── Subscription[]
      ├── Payment[]
      ├── Assignment[]
      └── Certificate[]
```

## 2.5 Who writes what (lifecycle)

| Entity | Create | Update | Delete |
|--------|--------|--------|--------|
| User student | register, Google | login lastLogin; settings telegram; admin block/reset | none in app |
| User teacher | invite / ensureTeacherUser | invite, reset password, block | none |
| User admin | `scripts/create-admin.ts` | UNKNOWN in UI | none |
| Faculty/Subject | seed only (app) | none found | cascade if deleted at DB |
| Teacher | admin POST /api/admin/teachers | invite sets userId/fullName; block user | none in app |
| Invite | admin teacher create | usedAt on accept; DELETE unused | DELETE unused |
| Course | ensureTeacherWorkspace, teacher courses API, admin courses API, seed | admin PATCH (incl isPublished, prices); enroll sets isPublished true | none in app (cascade from teacher) |
| Entitlement | demo payment upsert | demo payment overwrite; admin extend/cancel | none |
| Subscription | demo payment if courseId; enroll upsert | enroll expires others; admin extend/cancel | none (unique upsert) |
| Payment | demo payment, seed | none | none |
| Lesson | teacher lessons / courses plan / quick-live | lobby/start/end/patch/recording/mux webhook | DELETE if scheduled |
| Attendance | learn page upsert | empty update | none |
| Assignment | teacher API | none | none |
| Submission | student submit upsert | teacher grade | none |
| Certificate | teacher upsert | re-issue updates issuedAt | none |

## 2.6 Consistency risks (facts, not opinions)

1. **Entitlement vs Subscription can diverge** — different APIs update them independently (payment without courseId; admin extend/cancel; enroll copies entitlement into one course but later re-pay does not sync existing subs).
2. **Subscription unique(userId,courseId)** means renew/upgrade **overwrites** the same row; no history of previous periods.
3. **Payment has no unique/idempotency key** — double-click checkout creates two payments and still one entitlement upsert.
4. **Course cascade from Teacher/Faculty/Subject** — deleting a faculty would wipe teachers, courses, lessons, subscriptions.
5. **Teacher.userId SetNull** if User deleted — Teacher row remains; courses remain.
6. **Certificate.issuedBy** is a loose string, not a FK.
7. **ChatMessage GET is unauthenticated** while writes are gated — data exposure of names+text.
8. **Seed student** gets Subscription t1 on course c1 **without Entitlement** (`prisma/seed.ts`). Production enroll path requires entitlement first.
9. **SiteSetting** unused vs present.
10. **isPublished default true** — unpublished is opt-out, not draft workflow.
11. **Attendance unique** — reopen learn page does not update joinedAt (`update: {}`).
12. **Assignment.dueAt** is not enforced on submit API.

END OF PART 2


==================================================
SOURCE FILE: docs\audit\03-roles-permissions.md
==================================================

# PART 3 — Roles & Permissions

## 3.1 Role inventory

| Role | Storage | How obtained |
|------|---------|--------------|
| `student` | `UserRole` enum, default | `/api/auth/register`, Google first login |
| `teacher` | enum | Invite accept `/api/auth/invite`; admin `ensureTeacherUser` |
| `admin` | enum | `npm run admin:create` / seed; **no self-serve admin signup** |
| super-admin | **not a role** | email in `SUPER_ADMIN_EMAIL` or default `avazov@tdyu.live` AND `role===admin` |
| impersonated teacher | JWT `impersonatorId` | admin ticket → credentials `ticket` |

There is **no** `superadmin` in Prisma.

[FACT]
File: src/lib/roles.ts
Function: isAdminRole / isTeacherRole / isStudentRole
Relevant code: strict equality to `"admin"` / `"teacher"` / `"student"`
Meaning: any other string is treated as non-admin non-teacher; Sidebar then uses **student nav**.

## 3.2 Student

### A) Can see
Landing, auth pages, legal. After **active Subscription**: `/app`, `/my-courses`, `/schedule`, `/assignments`, `/certificates`, `/history`, `/search`, `/settings`, `/learn/[id]` (paywall if access fails), `/courses/[id]`. `/shorts` only if `canWatchLive` on **getAnyActiveSubscription** tier (t2/t3). `/onboard` if entitlement and no sub.

### B) Can create
Account, demo payment, enroll (teacher pick), assignment submission, chat messages (t2/t3 + access.ok), telegram chat id, password reset request.

### C) Can update
Submission upsert; telegram chat id; mark notifications read. **Cannot** update name/email/password in settings (UI says later). Theme via localStorage only.

### D) Can delete
Nothing via API (no account delete). Can clear own search history in localStorage.

### E) Cannot
Teacher/admin APIs (403). Live if t1. Chat if t1. Shorts nav hidden if sidebar `tariffTier==="t1"`. Start/end lessons. Issue certificates. Admin impersonate.

### F) Open routes (page)
See PART 10. Cabinet pages use `requireStudentCabinet` or `requireAppUser`.

### G) Open APIs
Auth public + session APIs listed in PART 10. Student-specific writes: enroll, payments/demo, assignments/submit, chat POST (if tier), live/signal (if live + access), notifications, settings/telegram, media/recording GET.

### H) UI navigation
Sidebar student: Bugun, Kurslarim, Dars reja; Yana: Shorts (hidden t1), Ko'rilganlar, Topshiriqlar, Sertifikatlar, Bosh sahifa. Avatar → `/settings`.

### I) Server permission
`requireStudentCabinet`, `requireAppUser`, `getLessonAccess`, enroll `isStudentRole`, assignment `getActiveSubscription`.

### J) Client permission
Sidebar hides Shorts for t1; CheckoutButton just links; TeacherPicker posts enroll; Learn paywall is **server-rendered**.

## 3.3 Teacher

### A) See
`/teacher`, `/teacher/reja`, `/teacher/group`, `/teacher/assignments`, `/teacher/live/[lessonId]`, `/settings`, `/` . If they open student cabinet URLs: `requireStudentCabinet` **redirects to `/teacher`**.

### B) Create
Courses (plan), lessons, assignments, certificates, lesson assets, local recordings, quick-live lesson.

### C) Update
Lesson patch (not lobby/live), lobby/start/end, grades, recording URL.

### D) Delete
Scheduled lessons only; own lesson assets.

### E) Cannot
Admin user/teacher/payment managers. Enroll as student (`isStudentRole` required). Delete live/ended lessons. Edit lesson while lobby/live.

### F) Routes
Teacher pages check `session.user.role !== "teacher"` → `/`. **Teacher layout does not auth.** Direct URL `/teacher` without login → login redirect on that page.

### G) APIs
All `/api/teacher/*` check `role === "teacher"` + `getTeacherForUser`. Missing Teacher profile → 404 `"Profil yo'q"`.

### H) Nav
Studio, Reja, O'quvchilar, Topshiriqlar, Bosh sahifa.

### I/J) Server vs client
Actions are fetch() from client components (`LiveStudio`, forms) to teacher APIs that re-check role. UI does not expose admin nav.

## 3.4 Admin

### A) See
`/admin/*` via `admin/layout.tsx`. Also `/settings`, `/`, certificate print (role admin). If they hit `/app`: `requireStudentCabinet` redirects `/admin`.

### B–D)
Create teachers+invites, courses; patch courses; block students/teachers; extend/cancel entitlements and subscriptions; impersonate teacher (ticket); super-admin reset passwords; delete unused invites.

**Cannot delete courses/users/payments via API found.** No admin lesson start.

### E) Cannot
Student enroll. Teacher lesson APIs unless impersonating.

### F) Routes
`/admin`, `/admin/users`, `/admin/teachers`, `/admin/courses`, `/admin/payments`. Layout: unauthenticated → login; non-admin → `/`.

### G) APIs
`/api/admin/*` + `isAdminRole`. Password reset endpoints additionally `viewerCanSeeCredentials`.

### H) Nav
AdminShell: Bugun, O'quvchilar, O'qituvchilar, Kurslar, To'lovlar. AppShell admin fallback (if used): Studio `/admin` + home. Admin LMS pages use **AdminShell**, not AppShell.

### I) Server: layout + each API.
### J) Client: AdminUsersManager / TeachersManager hide secret columns unless `canSeeSecrets`.

## 3.5 Super-admin (email)

Sees login+password reveal/copy; can POST reset-password for users and teachers. Other admins get 403 `"Faqat super admin"` on those APIs.

Alias: credentials login `avazov` maps to `avazov@tdyu.live` (`resolveLoginId`).

## 3.6 Impersonation

[FACT]
File: src/lib/auth.ts authorize
Relevant code: ticket `kind==="as"` requires admin not blocked and **target.role === "teacher"** only
Meaning: admin can impersonate teachers, **not students**.

Ticket TTL 120s (`createImpersonateTicket`). Restore via `/api/auth/stop-impersonate` + `kind:"back"`.

## 3.7 Blocked users

Checked at credentials/Google/invite/forgot-password. **Not** checked in `getLessonAccess` or most APIs after JWT exists.

Student block: `/api/admin/users/[id]/block` (students only).
Teacher block: `/api/admin/teachers/[id]/block` sets linked User.isBlocked.

## 3.8 UI hidden vs backend open

| Case | Evidence |
|------|----------|
| Shorts hidden for t1 in sidebar, but `/shorts` still reachable | Sidebar omits link; page `requireAppUser` then EmptyGuide if !canWatchLive. **Not a 403.** |
| Learn page reachable without cabinet subscription check | `learn/[id]` does **not** call `requireStudentCabinet`; uses `getLessonAccess` paywall. Direct URL works. |
| Search suggest **public** | GET `/api/search/suggest` no auth; SearchBar on AppShell (logged-in UX) but API is open |
| Chat GET public | `GET /api/lessons/[id]/chat` no auth |
| Lesson files public | `GET /uploads/lessons/[filename]` no auth |
| Assignment files under `/public/uploads/assignments` | Next static; submit stores public URL |
| Teacher APIs 403 if student forges fetch | role checked server-side |
| Admin pages | layout redirect; APIs 403 |
| `requireRole()` unused | pages duplicate checks |
| Payments demo: **any logged-in role** | no `isStudentRole` — teacher/admin can POST demo pay |
| Certificate print: **any teacher** can open **any** cert id | `role !== "admin" && role !== "teacher"` then owner check; teachers are allowed without course ownership |

## 3.9 Backend blocked, UI still shows

| Case | Evidence |
|------|----------|
| Lobby MeetRoom shown, signal API requires `status==="live"` | learn page `canJoinLive` includes lobby; `liveGate` rejects non-live. Teacher LiveStudio same MeetRoom in lobby. |
| Dashboard “Hozir jonli” + “Kirish” for t1 | `/app` links `/learn/[id]` even if `canWatchLive` false; badge “Yozuvdan keyin”. Learn then paywalls `live_locked`. |
| Upcoming scheduled lessons link to `/learn/[id]` | access reason `not_started` paywall |
| Course page lesson rows for subscribers always “Ochish” | no per-status/tier disable |
| Payme/Click buttons | always demo API |
| T3 “birinchi navbatda tekshirish” | teacher list is **sorted** by tier; no lock that t3 must be graded first |
| Certificates empty copy: “Kursni tugatib (darslar + topshiriqlar)” | issue API has **no** eligibility |
| Settings name/email/password fields | displayed read-only; no PATCH user profile API found |
| Language shown | `User.language` not writable in UI |

## 3.10 Role check locations (server)

- Pages: `access.ts`, `home-path.ts`, `admin/layout.tsx`, each teacher page, checkout, onboard, certificates/[id], settings
- APIs: inline `auth()` + `role !== "teacher"` or `isAdminRole` or `isStudentRole`
- Lesson: `getLessonAccess` (subscription, not role except staff bypass on learn page)

Staff bypass on **learn page only** (`staffJoin`): admin or course’s teacher. **media/recording** and **live/signal** have similar staff checks. **chat POST** too.

`getLessonAccess` itself has **no admin/teacher bypass**. Staff is layered in those callers.

END OF PART 3


==================================================
SOURCE FILE: docs\audit\04-pricing-access.md
==================================================

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


==================================================
SOURCE FILE: docs\audit\05-payment.md
==================================================

# PART 5 — Payment

## 5.1 What exists vs what does not

**Exists**
- UI checkout wizard: review → method → processing (2.2s delay) → receipt
- `POST /api/payments/demo`
- Prisma `Payment` rows
- Admin payments board + revenue KPIs counting `demo_paid` **and** `paid`

**Does not exist in repo**
- Payme Merchant/Subscribe API
- Click API
- Payment webhooks except Mux (unrelated)
- Refund API
- Status transitions pending→paid
- Idempotency keys
- Receipt email
- Real card charging

[FACT]
File: src/components/course/CheckoutClient.tsx
Function: `confirmPay`
Relevant code: always `fetch("/api/payments/demo", { body: { tier, courseId?, provider: method === "card" ? "demo" : method } })`
Meaning: Payme and Click are **UI labels**. Provider column can be `payme`/`click` while status is still `demo_paid`.

[FACT]
File: CheckoutClient.tsx
Relevant code: `"Hozircha demo rejim — haqiqiy pul yechilmaydi"` and aside `"Demo to‘lov: hisobingizga obuna yoziladi, bankdan pul yechilmaydi."`
Meaning: checkout **does** disclose demo. Method titles still say “Payme” / “Click” as if real.

## 5.2 Flow: USER → UI → API → DB → ACCESS → UI

### A. Landing tariff (no course)

USER: `#tariflar` → Tanlash
FRONTEND: `/checkout?tier=t1|t2|t3` (default t2 if invalid)
GATE: login required (`checkout/page.tsx`)
API: `POST /api/payments/demo` `{ tier, provider }`
DB: Payment insert; Entitlement upsert 30 days; **no Subscription**
ACCESS: cannot watch lessons; `resolveHomePath` / onboard
UI: chek; CTA “O‘qituvchi tanlash” → `/onboard`
If they already had an active sub: checkout still says onboard, but onboard redirects `/app`.

### B. Course page tariff

USER: `/courses/[id]` Tanlash
FRONTEND: `/checkout?tier=&courseId=`
API: same, amount from `course.priceT*`
DB: Payment with courseId; Entitlement upsert; **Subscription upsert for that course**
ACCESS: that course immediately
UI: CTA “Kabinetga o‘tish” (`next==="app"`)

### C. Demo karta vs Payme vs Click

All three hit the same API. `provider` stored as `demo` | `payme` | `click`. `status` always `demo_paid`.

### D. Real Payme / Click / webhook / refund / pending / cancelled / expired

**IMPLEMENTED EMAS** (no routes, no status writers except create as demo_paid).

Enum allows `pending`, `paid`, `failed` but **no code path sets them** in `src/` (only seed/demo create). Admin UI can **filter** those statuses (`AdminPaymentsBoard`) on rows that would only exist if inserted manually.

### E. Failed checkout

API 401 → redirect login with callback.
API 4xx/5xx → error string, step back to method.
No rollback UI for partial DB writes (server try/catch returns 500).

## 5.3 Who can pay

API checks `session.user.id` only. Teachers and admins can create demo entitlements for themselves. Students typically.

No CSRF token beyond cookie SameSite (NextAuth). Same-origin fetch from CheckoutClient.

## 5.4 Duplicate payment

No unique constraint. Two successful POSTs → two Payment rows, entitlement overwritten twice (same result if same tier). Amount summed **twice** in admin “revenue”.

## 5.5 Admin analytics vs money

[FACT]
File: src/lib/admin-stats.ts
Function: `getAdminDashboard`
Relevant code: `status: { in: ["demo_paid", "paid"] }` for `monthPayments` and `revenueByDay`
Meaning: **demo_paid counts as revenue**. There is no live `paid` writer, so “Shu oy to‘lov” is demo volume.

Same filter in `src/lib/admin-courses.ts` `course.payments` and `src/app/admin/payments/page.tsx` 14-day chart.

Admin payments page lists **all** statuses (take 300), chart sums demo_paid+paid only.

## 5.6 Privacy/terms

`privacy/page.tsx`: “To‘lov: keyinchalik ulanadigan gateway orqali; demo rejimda pul yechilmaydi.”
`terms/page.tsx`: “Demo to‘lov rejimida haqiqiy pul yechilmaydi.”
`TDYU_Live_TZ.md`: “To‘lov: hozir **demo** (Payme/Click keyin).”

END OF PART 5


==================================================
SOURCE FILE: docs\audit\06-course-lesson-live.md
==================================================

# PART 6 — Course / Lesson / Live / Recording / Attendance / Progress

## 6.1 Course lifecycle

**Statuses draft / active / paused / ended / archived: IMPLEMENTED EMAS.**
Only `Course.isPublished` boolean (default **true**).

### Who creates

1. `ensureTeacherWorkspace(teacherId)` (`src/lib/teacher-workspace.ts`)
   If teacher has zero courses: create title=`subject.nameUz`, description template, prices=`PLATFORM_PRICES`, published default true.
   Called from: enroll, invite accept, teacher home, teacher reja, teacher group, quick-live, admin teacher create.

2. `POST /api/teacher/courses` — teacher plan: title, N lessons, interval, firstAt. Prices platform. `isPublished: true`. Notify system on empty course.

3. `POST /api/admin/courses` — admin sets prices/teacher/faculty/subject.

4. Seed.

### Who edits

- Admin PATCH: title, description, teacher, faculty, subject, prices, isPublished.
- Enroll: `isPublished: true`.
- **Teacher has no course update/delete API.**

### Teacher “create course” UX

`/teacher` or `/teacher/reja` → `CreateCoursePlanForm` → POST teacher/courses → N `scheduled` lessons titled `"1-dars"` / firstTitle.

### Unpublished

`/courses/[id]` uses `findUnique({ where: { id, isPublished: true } })` → notFound if unpublished.
Student subs on unpublished course: `getActiveSubscriptions` still returns them (`isPublished` selected but **not filtered**). Lessons still accessible via `/learn` if subscription exists.

## 6.2 Lesson lifecycle

Prisma `LessonStatus`: `scheduled | lobby | live | ended`.

| Status | When | Who | Student UI | Can do | Access |
|--------|------|-----|------------|--------|--------|
| scheduled | create / quick-live | teacher POST lessons / courses / quick-live | “Reja”; learn paywall `not_started` | teacher: patch, delete, open lobby, jump to start | getLessonAccess false |
| lobby | POST `.../lobby` from scheduled | teacher | “Kutish”; MeetRoom if t2/t3 | wait in UI; **signal API rejects** (not live) | live_locked if t1; else ok |
| live | POST `.../start` from lobby **or scheduled** | teacher | “Jonli”; MeetRoom | WebRTC if signal ok; t1 locked | t2/t3 |
| ended | POST `.../end` or Mux webhook | teacher / mux | “Ko‘rish” or “Yozuv kutilmoqda” | VOD/chat | all tiers if sub active |

**cancelled: IMPLEMENTED EMAS.**

### Transitions (code)

```
create → scheduled
scheduled → lobby     (lobby route; notify t2+ lesson_starting)
scheduled | lobby → live   (start route; Mux stream; notify t2+ lesson_live)
any → ended           (end route; no status guard in end/route.ts)
live → ended          (mux webhook video.asset.ready)
```

[FACT]
File: src/app/api/teacher/lessons/[id]/end/route.ts
Relevant code: no `if (status !== live)` guard
Meaning: teacher can end a **scheduled** lesson (sets ended, optional recording).

[FACT]
File: src/app/api/teacher/lessons/[id]/route.ts
PATCH: blocked if live|lobby; scheduledAt change only if scheduled
DELETE: only scheduled

Quick-live: if any live lesson exists for teacher, return it `alreadyLive`; else create **scheduled** titled “Jonli dars” **without auto lobby/start**. UI must still open studio and press start.

### Mux webhook vs teacher end

Webhook sets `status: ended` + `muxVodPlaybackId` when asset ready. Can fire after teacher already ended. Overwrites status to ended again.

## 6.3 Live system (how it actually works)

Two layers:

1. **Classroom WebRTC** — `MeetRoom` polls `/api/live/signal` (join/poll/signal/event). Rooms in `globalThis.__tdyuLiveRooms` Map. Not shared across Node processes. Peer TTL 20s. STUN public servers, **no TURN**.

2. **Optional Mux RTMP** — on start, `createLiveStreamOrDemo`. LiveStudio shows RTMP URL + stream key if not `demo_`. Student learn page prefers MeetRoom when `canJoinLive`, **not** Mux iframe, for live/lobby.

Learn live playback mux iframe is only in the `canWatchVod && playbackId && !demo_` branch **after** `canJoinLive` is false. So t2 in live uses MeetRoom, not Mux player.

Moderator = admin or course teacher (`liveGate` / learn `staffJoin`). Students join with mic/cam off until grant.

Lobby UI: MeetRoom `phase="lobby"`.
[FACT]
File: src/app/api/live/signal/route.ts `liveGate`
Relevant code: `lesson.status !== "live"` → `{ ok: false }` **including moderators**
Meaning: **lobby MeetRoom cannot join the signaling room.** Buttons still render; `api()` throws “Ruxsat yo'q”.

Recording from MeetRoom: `MediaRecorder` webm; on teacher End, `saveRecording()` then POST end with `recordingUrl` (after upload via recording endpoint from LiveStudio — `saveRecording` returns URL from upload). LiveStudio `act("end")` calls `meetRef.saveRecording()` then end API.

## 6.4 Recording access vs tariff

- **Create:** teacher upload ≤120MB webm; and/or Mux VOD id; and/or end body `recordingUrl`.
- **Play:** learn page: local `/api/media/recording/[id]` if `recordingUrl`; else Mux iframe if playbackId not demo_; else placeholder “YOZUV KUTILMOQDA”.
- **When:** student needs `getLessonAccess` ok **or** staff. For ended, t1 is ok. For live, t1 is live_locked so they never get MeetRoom; they also fail canWatchVod for live... wait:

```
canJoinLive = (live|lobby) && (access.ok || staff)
canWatchVod = access.ok || staff
```

t1 live: access.ok false → no MeetRoom, no VOD branch, paywall `live_locked` (“Yozuv tugagach 1-tarifda ham ochiladi”).

t1 ended: access.ok true → can watch recording.

`hasPlayableRecording`: recordingUrl OR playbackId not starting with `demo_`. Demo mux ids are **not** playable.

media/recording GET: staff or getLessonAccess; path must start `uploads/recordings/`. Files also physically in `public/` (Next may static-serve them — **potential bypass**, see PART 11).

## 6.5 Student live timing

| Question | Code answer |
|----------|-------------|
| When lobby? | After teacher POST lobby; t2/t3 access.ok; MeetRoom shown; **signal fails** |
| When live? | After teacher start; t2/t3; MeetRoom + signal allowed |
| When recording? | After ended + playable file/mux; **all tiers** with active sub |
| Live tariff | t2, t3 (`canWatchLive`) |
| Recording tariff | any active subscription (t1 included) |

Admin/teacher of that course: staffJoin, no tariff.

## 6.6 Attendance

**Fields that exist:** `id`, `userId`, `lessonId`, `joinedAt`.
**Do not exist:** leftAt, duration, attendance status enum.

[FACT]
File: src/app/learn/[id]/page.tsx
Relevant code:
```
if (access.ok && session.user.id && (status live|lobby|ended)) {
  attendance.upsert({ update: {}, create: { userId, lessonId } })
}
```
Meaning: **opening the learn page** with access creates attendance. Not MeetRoom join. Not video play. `update: {}` so re-open does not refresh joinedAt.

scheduled: no attendance.
t1 live: no attendance (access not ok).
staff (teacher/admin) without student sub: **no** attendance (requires access.ok, not staffJoin).

**Used in**
- Student `/app` “Davom ettirish” = latest attendance
- `/history` “Ochgan darslaringiz” = attendance list take 50
- Teacher group `attendPct` = attended lessons / lessonCount (any attendance row)
- Admin course `attendancePct` = present seats / (active students × ended-or-attended lessons)

## 6.7 Progress formulas

### Learn page “Kurs progressi”

[FACT]
File: src/app/learn/[id]/page.tsx
Relevant code:
```
doneCount = playlist.filter(ended && hasPlayableRecording).length
progressPct = round(doneCount / playlist.length * 100)
UI: "{index+1}/{playlist.length} dars" and "{progressPct}% yozuv tayyor"
aria-label="Kurs progressi"
```
Meaning: **N/M is playlist position, not completion. % is recording readiness of the course, not the student.** Independent of attendance.

### Teacher studio course card `withVideo`

ended + hasPlayableRecording count vs total lessons (`teacher/page.tsx`).

### Teacher group student `pct`

`attended / course.lessons.length * 100` where attended = lessons with any attendance row for that user (**includes scheduled? only if they had access — they don't**). Counts lobby/live/ended opens. Includes lessons without recordings.

### Admin course health

`src/lib/admin-courses.ts` `healthOf`: live if liveCount>0; empty if no lessons; on_track if future scheduled; stale if ended and last lesson >14 days; else idle.

### Certificates empty state

Copy claims finish lessons+assignments; **no formula in issue API**.

### 5/7 style

If playlist has 7 lessons and 5 ended with playable VOD, learn shows `k/7 dars` (position) and `71% yozuv tayyor`. It does **not** mean the student watched 5.

END OF PART 6


==================================================
SOURCE FILE: docs\audit\07-student-ux.md
==================================================

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


==================================================
SOURCE FILE: docs\audit\08-teacher-ux.md
==================================================

# PART 8 — Teacher UX

## 8.1 How a teacher account appears

1. Admin POST `/api/admin/teachers` → Teacher row + invite (14 days) + `ensureTeacherWorkspace`.
2. Email/notify contains `/invite/[token]`.
3. Teacher sets name+password POST `/api/auth/invite` → User role teacher, invite usedAt, workspace ensured.
4. Login `/login` → `/go` → `/teacher`.

If User.role is teacher but no Teacher profile: studio empty state “Admin sizni fan bilan bog'lagach…”.

Admin can also `ensureTeacherUser` via impersonate or password reset (creates user without invite).

## 8.2 Flow

| Stage | Screen | CTA | API | DB | Next |
|-------|--------|-----|-----|-----|------|
| Login | `/login` | | NextAuth | lastLogin | `/teacher` |
| Studio | `/teacher` | course cards “Studioga — shu dars”; SoftDisclosure new course; QuickLive | ensureTeacherWorkspace SSR; POST teacher/courses; POST quick-live | course/lessons | `/teacher/live/[id]` |
| Reja | `/teacher/reja` | create course / create lesson / board actions | POST lessons, PATCH/DELETE lesson | lessons | refresh / live |
| Live studio | `/teacher/live/[lessonId]` | Kutish / Boshlash / Tugatish | lobby, start, end, recording | status, mux, recordingUrl | refresh or `/teacher` |
| Group | `/teacher/group` | Sertifikat berish | POST certificates | Certificate | refresh |
| Assignments | `/teacher/assignments` | create, GradeForm | POST assignments, POST grades | Assignment, Submission | refresh |
| Settings | `/settings` | telegram | PATCH telegram | | |

**No dedicated teacher analytics page.** Studio KPIs: course count, next countdown, ungraded submissions, running live/lobby count. Group has attend %.

## 8.3 Studio home (`/teacher`)

- Redirect if not teacher.
- `ensureTeacherWorkspace`.
- KPIs + alert stack for live/lobby lessons.
- Course cards: phase new/planned/ongoing/active; withVideo count; activeStudents; actionable lessons → live studio.
- `CreateCoursePlanForm` in disclosure.
- Dead components **not used**: `TeacherHub.tsx`, `TeacherStudioFocus.tsx`.

## 8.4 Reja (`/teacher/reja`)

CreateCoursePlanForm + CreateLessonForm + TeacherRejaBoard (schedule table, edit panel, lesson actions: lobby/start/end/delete).

## 8.5 Live studio (`LiveStudio.tsx`)

- scheduled: button open lobby; can also start (API allows scheduled→live).
- lobby: MeetRoom phase lobby; start button; RTMP key after start.
- live: MeetRoom live; end uploads recording then POST end; closeLiveRoom.
- OBS: CopyField RTMP + key if not demo_.
- LessonInventory for assets (present files).

QuickLiveButton: POST quick-live → navigate to `/teacher/live/{id}` (lesson still **scheduled** unless alreadyLive).

## 8.6 Group (`TeacherGroupBoard`)

Per course: activeCount, t1/t2/t3 counts, attendPct, student list with attended/lessonCount/pct, seenTitles, hasCert, IssueCertificateButton.

**No server check** that student completed anything before cert.

## 8.7 Assignments + grading

CreateAssignmentForm: course, title, description, dueAt. Notifies all active subs (all tiers).

GradeForm: 0–100 + note. Notifies student type grade.

List sorted so t3 submissions appear first (`tierRank`). Missing students listed. Late flag if dueAt < now. **Submit after due still accepted.**

## 8.8 Teacher cannot (in UI/API)

- Unpublish own course
- Delete course
- Change prices (admin only)
- See payments
- Block students
- Access other teachers’ lessons (ownedLesson filter)

END OF PART 8


==================================================
SOURCE FILE: docs\audit\09-admin-ux.md
==================================================

# PART 9 — Admin UX

## 9.1 Gate

`src/app/admin/layout.tsx`: login required; `isAdminRole` else `/`. Shell: `AdminShell` (not AppShell).

## 9.2 Nav (AdminShell)

Bugun `/admin` · O'quvchilar `/admin/users` · O'qituvchilar `/admin/teachers` · Kurslar `/admin/courses` · To'lovlar `/admin/payments`. Top: Bosh sahifa, theme, settings, signOut.

**No** dedicated subscriptions page, invites page (invites live on teachers), or settings/CMS page. SiteSetting unused.

## 9.3 Bugun `/admin`

`getAdminDashboard()` + AdminCapabilities + KPI cards + charts + Diqqat (live, invites, expiring subs).

### Metrics formulas

| METRIC | FORMULA | SOURCE | FILTER | TIME | MISREAD RISK |
|--------|---------|--------|--------|------|----------------|
| O'quvchilar | `user.count role=student` | users | all students | all time | includes blocked, never-paid |
| O'qituvchilar | `teacher.count` | teachers | profile rows | all | includes invite-pending (userId null) |
| Invite kutilmoqda | `teacher.count userId=null` | teachers | | | |
| Teachers blocked KPI | `user.count role=teacher isBlocked` | users | | | not shown as main card; in query |
| Kurslar | `course.count` | all | includes unpublished | | |
| Faol obuna | subscriptions `endsAt > now` length | | | now | **course subs**, not entitlements; user with 2 courses counts 2 |
| Hozir jonli | `lesson.count status=live` | | | now | |
| Shu oy to'lov | sum amount | payments | createdAt ≥ monthStart local JS, status in demo_paid,paid | calendar month of **server local TZ** (`new Date(y, m, 1)`) | **demo money**; TZ may not be Tashkent |
| Tiers donut | count active subs by tier | same activeSubs | | | |
| Registrations chart | students createdAt last 30 Tashkent days | | role student | 30d | |
| Revenue chart | sum demo_paid+paid last 30 Tashkent days | | | 30d | demo |
| Lesson status week | lessons scheduledAt in [now-7d, now+7d] by status | | | | |
| Top courses | take 40 newest courses, count active subs, top 5 | | | | not “all time popular” |
| Expiring | subs endsAt in (now, now+7d] take 6 | | | 7d | |
| Course health | see admin-courses healthOf | | | | stale groups idle+stale |
| Course attendancePct | present unique (lesson,user) / (activeStudents × lessonsInSet) | ended or any attendance | active subs only | | page-open attendance |
| Course paymentSum | sum demo_paid+paid on that course | Payment.courseId | | all time | platform pays have courseId null → **not** on course |

`monthStart` uses **server timezone**, while day series uses Asia/Tashkent. Potential split.

## 9.4 Students `/admin/users`

AdminUsersManager: filter, block, entitlement ±30 / cancel, subscription ±30 / cancel, super-admin password reveal.

Tariff column: `activeEntitlement ?? first activeSub` (`admin/users/page.tsx`).
`hasSubscription` true if either.
`courseCount`: active count or all subs length.
`completedCourses`: certificate count (not progress).
`lessonCount`: attendance count.

## 9.5 Teachers `/admin/teachers`

Invite create, copy URL, delete unused invite, block linked user, impersonate, super-admin password.

Impersonate: POST `/api/admin/impersonate` → ticket → client signIn credentials with ticket (see ImpersonateTeacherButton).

## 9.6 Courses `/admin/courses`

AdminCoursesBoard from `getAdminCourseBoard`: groups by teacher, health, prices edit, publish toggle. POST create / PATCH update. **No delete.**

## 9.7 Payments `/admin/payments`

Last 300 payments; 14-day chart demo_paid+paid; filters in client board; emails only if super-admin.

## 9.8 Missing admin UX vs TZ

TZ: “kurs/tarif, statistika, to‘lovlar”. No in-app faculty/subject manager. No real settlement. No impersonate student.

END OF PART 9


==================================================
SOURCE FILE: docs\audit\10-api-routes.md
==================================================

# PART 10 — APIs & Routes

## 10.1 Page routes

| ROUTE | ROLE | PURPOSE | ACCESS | MAIN | API | DB | CTA | STATES |
|-------|------|---------|--------|------|-----|----|-----|--------|
| `/` | public | marketing | none | page.tsx pricing | none | session, sub, entitlement | register/login/tarif/onboard/app | guest / paid / onboarded |
| `/go` | any | redirect home | auth | go/page | — | sub/ent | — | redirect |
| `/login` | public | login | none | LoginForm | NextAuth | user | go | error/loading/Google |
| `/register` | public | signup | none | RegisterForm | POST register | user | login | validation 409 |
| `/forgot-password` | public | reset request | RL | form | POST forgot | tokens | — | generic ok |
| `/reset-password` | public | set pw | RL | form | POST reset | user hash | login | invalid token |
| `/invite/[token]` | public | teacher accept | valid invite | InviteForm | POST invite | user, teacher | login | 404 expired |
| `/checkout` | logged-in | demo pay | login | CheckoutClient | POST demo | payment, entitlement, sub? | onboard/app | review/method/processing/success/error |
| `/onboard` | student | pick teacher | entitlement, no sub | TeacherPicker | POST enroll | sub | /app | empty teachers |
| `/app` | student | Bugun | requireStudentCabinet | page | — | lessons, assignments, attendance | learn | empty |
| `/my-courses` | student | subs | cabinet | MyCoursesBoard | — | all subs | courses | empty/filter |
| `/schedule` | student | plan | cabinet | ScheduleBoard | — | lessons | learn | empty |
| `/assignments` | student | tasks | cabinet | AssignmentsBoard | POST submit | assignments | submit | empty/late/done |
| `/certificates` | student | list | cabinet | page | — | certs | print | empty |
| `/certificates/[id]` | owner/admin/any teacher | print | auth + role/owner | page | — | cert | print | 404 / redirect |
| `/history` | logged-in student+ | history | requireAppUser | HistoryBoard | — | attendance | learn | empty |
| `/search` | app user | courses | requireAppUser | page | suggest | courses | course | empty/noq |
| `/shorts` | app user | live feed | t2/t3 students | LiveShortsFeed | — | live lessons | | locked/empty |
| `/courses/[id]` | public | course | published | page | — | course | checkout/learn | 404 unpublished |
| `/learn/[id]` | public SSR | watch | getLessonAccess / staff | MeetRoom/video | attendance, chat, signal | lesson | tarif/login | paywall/live/ended |
| `/settings` | logged-in | profile | auth | SettingsForm | PATCH telegram | user | — | — |
| `/privacy` `/terms` | public | legal | none | static | — | — | — | — |
| `/admin` | admin | KPI | layout | charts | — | dashboard | nav | — |
| `/admin/users` | admin | students | layout | AdminUsersManager | entitlements, block, reset | users | | |
| `/admin/teachers` | admin | teachers | layout | AdminTeachersManager | teachers APIs | | |
| `/admin/courses` | admin | courses | layout | AdminCoursesBoard | courses APIs | | |
| `/admin/payments` | admin | payments | layout | AdminPaymentsBoard | — | payments | | |
| `/teacher` | teacher | studio | page | page | courses, quick-live | | live |
| `/teacher/reja` | teacher | plan | page | forms+board | lessons CRUD | | |
| `/teacher/live/[lessonId]` | teacher owner | studio | page | LiveStudio | lobby/start/end | | |
| `/teacher/group` | teacher | roster | page | TeacherGroupBoard | certificates | | |
| `/teacher/assignments` | teacher | grade | page | forms | assignments, grades | | |

No `loading.tsx` / `error.tsx` anywhere under `src/app`.

## 10.2 API inventory

Auth: JWT cookie via NextAuth. Unless noted.

### Auth

| METHOD | PATH | AUTH | ROLE | INPUT | VALIDATION | READ | WRITE | OUT | ERR | SIDE |
|--------|------|------|------|-------|------------|------|-------|-----|-----|------|
| GET/POST | `/api/auth/[...nextauth]` | NextAuth | — | — | — | users | lastLogin | session | — | Google create |
| POST | `/api/auth/register` | public | — | name,email,pw | zod | user email | user student | 201 user | 400 409 500 | log |
| POST | `/api/auth/invite` | public | — | token,name,pw | zod | invite | user teacher, invite used, workspace | ok email | 400 403 409 500 | |
| POST | `/api/auth/forgot-password` | public RL 5/15m | — | email | zod | user | tokens | generic ok (+dev URL) | 400 429 500 | email |
| POST | `/api/auth/reset-password` | public RL 10/15m | — | token,pw | zod | token | hash, usedAt | ok | 400 403 429 | |
| POST | `/api/auth/stop-impersonate` | session impersonatorId | — | — | — | — | — | ticket | 400 | |

### Student / shared writes

| METHOD | PATH | AUTH | ROLE | INPUT | VAL | READ | WRITE | OUT | ERR | SIDE |
|--------|------|------|------|-------|-----|------|-------|-----|-----|------|
| POST | `/api/enroll` | yes | student | teacherId | zod | entitlement, teacher | expire other subs, upsert sub, publish course | ok courseId | 401 400 403 404 500 | workspace |
| POST | `/api/payments/demo` | yes | any | tier, courseId?, provider | zod | course? | payment, entitlement, sub? | next, payment | 401 400 404 500 | 30d |
| POST | `/api/assignments/submit` | yes | any with sub | form assignmentId, text, file≤8MB | manual | assignment, sub | submission upsert, disk | item | 401 403 404 400 | public file |
| GET | `/api/notifications` | optional | — | — | — | notifs 20 | — | items or [] | — | |
| PATCH | `/api/notifications` | yes | — | — | — | — | isRead true | ok | 401 | |
| PATCH | `/api/settings/telegram` | yes | — | chatId | zod digits | — | telegramChatId | ok | 401 400 | |
| GET | `/api/search/suggest` | **no** | public | q | len | lessons, teachers, courses | — | suggestions | — | |
| GET | `/api/lessons/[id]/chat` | **no** | public | — | — | 120 msgs | — | items | — | |
| POST | `/api/lessons/[id]/chat` | yes | staff or t2/t3 access | text 1–500 | manual | lesson, access | chatMessage | 201 item | 401 403 404 400 | priority t3 |
| POST | `/api/live/signal` | yes | staff or access | join/leave/signal/poll/event | zod | lesson **live only** | memory room | snap | 401 403 400 | |
| GET | `/api/media/recording/[id]` | yes | staff or access | Range | path prefix | lesson | — | 200/206 stream | 401 403 404 | |
| GET | `/uploads/lessons/[filename]` | **no** | public | filename | no `..` | disk | — | file CORS * | 404 | |

### Teacher

| METHOD | PATH | AUTH | INPUT | WRITE | NOTES |
|--------|------|------|-------|-------|-------|
| POST | `/api/teacher/lessons` | teacher+profile | courseId, title, summary, cover, scheduledAt | lesson | notify students+teacher |
| PATCH | `/api/teacher/lessons/[id]` | owner | title/summary/cover/scheduledAt | lesson | not lobby/live |
| DELETE | `/api/teacher/lessons/[id]` | owner | — | delete | scheduled only |
| POST | `.../lobby` | owner | — | status lobby | notify t2 |
| POST | `.../start` | owner | — | live + mux | notify t2 |
| POST | `.../end` | owner | recordingUrl? | ended, mux complete, close room | notify all |
| POST | `.../recording` | owner | file ≤120MB | recordingUrl | disk |
| GET/POST | `.../assets` | owner | file ≤20MB MIME list | LessonAsset | disk |
| DELETE | `.../assets/[assetId]` | owner | — | unlink+delete | |
| POST | `/api/teacher/lessons/quick-live` | teacher | — | scheduled or existing live | |
| POST | `/api/teacher/courses` | teacher | plan | course+lessons | notify |
| POST | `/api/teacher/assignments` | teacher | course, title, desc, due | assignment | notify |
| POST | `/api/teacher/grades` | teacher | submissionId, grade 0–100, note | submission | notify grade |
| POST | `/api/teacher/certificates` | teacher | courseId, userId uuid | cert upsert | notify; **no enrollment check** |

All teacher routes: 403 if not teacher, 404 if no profile / not owner.

### Admin

| METHOD | PATH | EXTRA AUTH | WRITE |
|--------|------|------------|-------|
| POST | `/api/admin/entitlements/[userId]` | admin | extend/cancel entitlement only |
| POST | `/api/admin/subscriptions/[id]` | admin | extend/cancel sub only |
| POST | `/api/admin/impersonate` | admin | ticket (ensureTeacherUser) |
| POST | `/api/admin/users/[id]/block` | admin | student isBlocked |
| POST | `/api/admin/users/[id]/reset-password` | **super** | random pw, returns plaintext |
| POST | `/api/admin/teachers` | admin | teacher+invite; notify admin |
| POST | `/api/admin/teachers/[id]/block` | admin | linked user isBlocked |
| POST | `/api/admin/teachers/[id]/reset-password` | **super** | ensureTeacherUser + plaintext |
| DELETE | `/api/admin/teachers/invites/[id]` | admin | unused invite |
| POST | `/api/admin/courses` | admin | course |
| PATCH | `/api/admin/courses/[id]` | admin | course fields |

### Infra

| METHOD | PATH | AUTH | EFFECT |
|--------|------|------|--------|
| POST | `/api/mux/webhook` | **none** | ended + muxVodPlaybackId + notify |
| POST | `/api/telegram/webhook` | optional secret header | handleTelegramUpdate |
| GET | `/api/cron/lesson-reminders` | CRON_SECRET required | reminders |
| GET | `/api/cron/telegram-poll` | CRON_SECRET if set | pollTelegramOnce |

## 10.3 Frontend component map (high-traffic)

```
AppShell → Sidebar, Topbar → SearchBar, NotificationBell, theme
AdminShell → admin nav + AdminCapabilities/Charts/managers
CheckoutClient → payments/demo
TeacherPicker → enroll
LiveStudio → MeetRoom → live/signal; lobby/start/end
Learn page → MeetRoom | media/recording | mux iframe | LiveChat
```

END OF PART 10


==================================================
SOURCE FILE: docs\audit\11-security-performance.md
==================================================

# PART 11 — Security / Performance / Accessibility / Mobile / Notifications / Search

## 11.1 Security context (mechanisms present or absent — not an exploit guide)

| Topic | What exists | What does not |
|-------|-------------|----------------|
| Auth | NextAuth JWT, credentials bcrypt 12, optional Google | No middleware; JWT not refreshed against isBlocked/role |
| Session | JWT strategy `src/lib/auth.ts` | No DB session store |
| Cookies | NextAuth default (trustHost true) | Cookie flags not customized in repo |
| CSRF | Same-origin fetch; NextAuth cookies | No explicit CSRF token on POST APIs |
| Password | min 8 on register/invite/reset; bcrypt | Settings cannot change password |
| Reset | hashed token, 1h expiry, generic response, IP RL 5/15m and 10/15m **in-memory** | Multi-instance RL ineffective |
| Secrets | `.env*` gitignored; `.secrets/` gitignored; AUTH_SECRET | impersonate HMAC fallback `"dev-only-change-me"` if AUTH_SECRET missing |
| Super-admin | email allowlist | Default email hardcoded in source |
| IDOR | teacher lessons scoped by teacherId; grades scoped; enroll uses session user | **Certificate GET** any teacher; **certificates API** no “is this my student” check; **chat GET** public; **search suggest** public; **lesson uploads** public |
| Admin checks | layout + each admin API `isAdminRole` | |
| Direct API | no middleware; fetch with session cookie works | |
| Rate limit | forgot/reset only (`src/lib/rate-limit.ts` Map) | login, enroll, payments, chat, signal **unlimited** in code |
| Validation | zod on many POSTs | chat POST uses `String(body.text)` not zod; assignments formData manual |
| XSS | React default escaping; Telegram HTML parse_mode on notify titles | User-generated lesson titles in HTML telegram |
| Upload | size limits 8/20/120MB; assignment filename sanitized; lesson MIME allowlist; recording webm name | assignments MIME not checked; stored in **public/**; lesson GET CORS * |
| Payment | demo only | Mux webhook **unsigned**; demo pay any logged-in role |
| Live | auth on signal; status must be live | rooms in process memory; peerId client-supplied (8–80 chars) not bound to userId |
| Impersonate | HMAC ticket 120s, teacher-only | |
| Cron | lesson-reminders requires secret; telegram-poll **open if secret unset** | secret also accepted as `?secret=` query |
| Exposed data | admin super sees emails/passwords-after-reset | seed demo passwords in README |

Login does not rate-limit brute force in this codebase.

`isBlocked` is not queried in `getLessonAccess` or teacher APIs.

## 11.2 Performance context

| Topic | Evidence |
|-------|----------|
| Server components | Most pages |
| Client | MeetRoom (large), Checkout, Sidebar, boards, LiveStudio, SearchBar |
| Fetch | force-dynamic almost everywhere — **no ISR/revalidate** |
| Caching | Next default; recording Cache-Control private no-store; lesson files public max-age 3600 |
| Polling | MeetRoom polls live/signal; NotificationBell fetch on open only |
| Realtime | not websocket; HTTP poll + in-memory |
| Expensive queries | admin-courses loads **all courses** with lessons+attendance+payments; teacher group same; admin users all students |
| N+1 | `notifyCourseStudents` loops notifyUser (each creates notif + optional telegram/email); reminder loops findFirst per lesson |
| Lists | payments take 300; history 50; search 24; suggest 6+4+3 |
| Video | Mux iframe or `<video>` local; MeetRoom getUserMedia |
| Images | SVG thumbs `thumbs.ts`; mux thumbnail URL |
| Heavy libs | framer-motion, tsparticles on landing, MeetRoom WebRTC |
| Live rooms | per Node process; PM2 cluster would split rooms (**UNKNOWN** if cluster_mode) |

`getShellData` may send reminders on **every** AppShell render for students.

## 11.3 Accessibility (from code, not audit lab)

**Present:** many `aria-label`s (bell, search, checkout steps/radiogroup, meet room, sidebar menu, filter tabs, admin caps); `lang="uz"`; checkout `role="radiogroup"`; FilterChips `role="tablist"`; `prefers-reduced-motion` in `globals.css` (multiple blocks) and Sidebar `animate={!reduced}`; password show/hide labels.

**Absent / weak:** no `src/app/**/error.tsx`; NotificationBell and profile menus are `div.dropdown` **not** `role="dialog"` / no focus trap (UNKNOWN if keyboard-complete); MeetRoom complexity — keyboard coverage ANIQLANMADI without runtime; contrast depends on CSS tokens (DESIGN.md claims tokens; runtime measurement UNKNOWN); some icon-only buttons.

## 11.4 Responsive / mobile (from CSS/components)

- Sidebar: `hidden md:flex` desktop 60↔300px; `md:hidden` full drawer; toggle event only if `max-width: 767px` (`Sidebar.tsx`).
- Admin sidebar: separate CSS (`admin-shell`); mobile behavior ANIQLANMADI beyond globals.
- globals.css media queries include ~520, 640, 700, 767/768, 800, 860, 900, 960.
- Checkout: `lx-checkout-shell` — layout CSS exists; exact column collapse ANIQLANMADI without screenshot.
- Tables: teacher reja / admin users use cards+filters more than HTML tables.
- Video: `playsInline` on learn video.
- E2E project: **Desktop Chrome only** (`playwright.config.ts`).

Visual mobile QA: **UNKNOWN**.

## 11.5 Notifications

| Trigger | Condition | Delivery | UI |
|---------|-----------|----------|-----|
| AppShell load | student; lesson scheduled in 15m; sub active; no lesson_starting last 24h | notifyUser DB+tg+email | bell |
| Cron lesson-reminders | same batch all users | same | bell |
| Lobby | t2+ subs | lesson_starting | bell → `/learn/id` |
| Start live | t2+ | lesson_live | `/learn/id` |
| End / mux ready | all active subs | lesson_live copy “Yozuv tayyor” or “Dars tugadi” | `/learn/id` |
| New lesson | all subs | system | **bell maps system → `/learn/{relatedId}`** (relatedId is lesson id here — OK) |
| New course plan | notifyCourseStudents with relatedId=**course.id** | system | bell → `/learn/{courseId}` **wrong target** |
| Assignment | all subs | assignment | `/assignments` (relatedId unused in href) |
| Grade | that user | grade | itemHref returns **null** for grade (no type handler) → **not a link** |
| Certificate | that user | certificate | `/certificates/{id}` |
| Admin teacher invite | notifyUser to **admin** with invite URL in message | system | relatedId=teacher.id → `/learn/teacherId` wrong |

Telegram bot: link via settings chat id or `start=u_{userId}`; menus today/courses/status.

No subscription-expiry notifier in code. No payment notifier.

## 11.6 Search

| Piece | Behavior |
|-------|----------|
| Data | suggest: published lessons (title/course), teachers by name, published courses title. Page: published courses title/desc/teacher/subject/faculty, q≥2, take 24 |
| Debounce | 250ms (`SearchBar.tsx`) |
| Suggestions | mixed types; video click → `/learn/{id}` (may paywall) |
| History | localStorage `ot-search-history` max 15 |
| Keyboard | activeIndex in SearchBar (arrows — code present) |
| Permissions | **suggest API public**; search **page** requires requireAppUser |
| Ranking | lessons scheduledAt desc, then teachers, then courses; no relevance score |
| Unused | `getActiveSubscriptions` imported in search/page.tsx **unused** (explorer note) |

END OF PART 11


==================================================
SOURCE FILE: docs\audit\12-contradictions-edge-cases.md
==================================================

# PART 12 — Contradictions / Edge cases / Docs vs code / Git / TODO

## 12.1 Contradiction detector

### A) Frontend ↔ backend

| ID | SEVERITY | EVIDENCE |
|----|----------|----------|
| C-A1 | **CRITICAL** | Learn/LiveStudio render MeetRoom for **lobby**; `liveGate` requires `status==="live"`. File: `learn/[id]/page.tsx` vs `api/live/signal/route.ts` |
| C-A2 | HIGH | Enroll UI one teacher; `POST /api/payments/demo` with courseId allows a second active sub. Files: `enroll/route.ts` vs `payments/demo/route.ts` vs `/app` “N ta kurs” |
| C-A3 | HIGH | Checkout `next=onboard` after platform pay even if active sub exists; onboard redirects `/app`. `CheckoutClient` vs `onboard/page.tsx` |
| C-A4 | MEDIUM | Search suggest → `/learn/id` without access; search page only courses |
| C-A5 | MEDIUM | Teacher certificate API does not verify student subscription; UI is on group of **active** students only — API can be called with any userId uuid |

### B) UI label ↔ behavior

| ID | SEV | EVIDENCE |
|----|-----|----------|
| C-B1 | HIGH | `aria-label="Kurs progressi"` + “% yozuv tayyor” — formula is VOD readiness not student completion. `learn/[id]/page.tsx` |
| C-B2 | HIGH | History “Ko'rilganlar” / “Ochgan darslaringiz” = attendance on page open. `history/page.tsx` |
| C-B3 | HIGH | Payme/Click titles vs demo API. `CheckoutClient.tsx` |
| C-B4 | MEDIUM | T3 “birinchi navbatda tekshirish” = sort, not exclusive queue. `teacher/assignments/page.tsx` |
| C-B5 | MEDIUM | Certificates empty: “Kursni tugatib (darslar + topshiriqlar)” vs issue API no check |
| C-B6 | LOW | Settings “keyingi yangilanishda” for name/email/password — fields visible |

### C/D) Pricing page ↔ access / tariff UI ↔ backend

| ID | SEV | EVIDENCE |
|----|-----|----------|
| C-C1 | HIGH | Landing `PLATFORM_PRICES`; course page `course.priceT*`; can differ |
| C-C2 | HIGH | Access uses **Subscription.tier**; landing after pay without enroll uses **Entitlement** only |
| C-C3 | MEDIUM | Shorts lock uses **one** any-active-sub tier; assignments use **all** subs |

### E) Subscription ↔ entitlement

| ID | SEV | EVIDENCE |
|----|-----|----------|
| C-E1 | **CRITICAL** | Re-pay platform updates entitlement, **not** existing subscription. `payments/demo` vs `getLessonAccess` |
| C-E2 | HIGH | Admin extend entitlement ≠ extend subscription (separate APIs) |
| C-E3 | MEDIUM | Seed student has Subscription **without** Entitlement |

### F) Teacher picker ↔ enroll

Picker sends `teacherId`. Enroll binds **first course** `findFirst` / create workspace — not a course picker. Teacher with two courses (seed Karimov has c1 and c2): student gets **whichever findFirst returns** (createdAt/id order **ANIQLANMADI** — Prisma findFirst without orderBy).

### G) Dashboard ↔ database

`/app` counts **all** active subscriptions; landing tarif status shows **one** any-sub.

### H) Analytics ↔ transactions

Revenue includes `demo_paid`. No `paid` writer. Platform payments `courseId` null omitted from per-course paymentSum.

### I) Progress label ↔ calculation

See C-B1.

### J) Attendance label ↔ creation

Teacher “Davomat” / admin attendancePct use rows created by **opening learn**, including lobby, not necessarily live presence (`learn/[id]/page.tsx` upsert).

### K) Role nav ↔ server

t1 Shorts hidden but URL works (EmptyGuide). `/learn` has no cabinet gate. Teacher layout unauthenticated until page. Admin layout gated.

### L) Public marketing ↔ features

TZ §5: `/` “katalog (chip filtr, video-grid)”. Code: marketing landing. `HomeContent.tsx` unused catalog UI.
TZ: Inter + blue accent. DESIGN.md: Syne/Plus Jakarta, teal dark / blue light.
SETUP.md IP `3.79.57.253` vs rules `3.65.92.39`.

## 12.2 Edge cases (SUPPORTED / UNSUPPORTED / UNKNOWN)

1. Payment wrote, DB later failed after payment insert — **SUPPORTED** as 500; orphan Payment possible (no transaction).
2. Payment success, subscription failed — if courseId and upsert throws: 500; entitlement may already be written — **SUPPORTED** partial.
3. Subscription expired — cabinet → entitlement? onboard : `#tariflar`. Learn `expired`. **SUPPORTED**.
4. Old subscription — unique overwrite on enroll/course pay. History of periods **UNSUPPORTED**.
5. New tariff pay — entitlement overwrite; sub not auto-synced — **SUPPORTED** as diverge.
6. Other teacher — UI blocked while sub active; API enroll expires others — **SUPPORTED** API / **UNSUPPORTED** UI.
7. Multiple courses — course checkout **SUPPORTED**; enroll **UNSUPPORTED** (expires others).
8. Lesson not started — paywall not_started **SUPPORTED**.
9. Lesson live — t2/t3 MeetRoom **SUPPORTED**; t1 locked; signal live-only **SUPPORTED**.
10. Lesson ended — VOD if playable **SUPPORTED**.
11. Recording not ready — placeholder **SUPPORTED**.
12. Recording exists — media API or mux **SUPPORTED**.
13. Teacher edits course — **UNSUPPORTED** (no teacher PATCH course). Admin PATCH **SUPPORTED**.
14. Teacher deletes course — **UNSUPPORTED**. Lesson delete scheduled only.
15. Student blocked — login denied; existing JWT **UNKNOWN** until expiry (not rechecked).
16. Teacher blocked — login denied; live APIs still accept JWT **UNKNOWN**/likely **SUPPORTED** until re-login.
17. Admin — full admin shell **SUPPORTED**.
18. Unauthorized API — 401/403 JSON **SUPPORTED** on gated routes; some GET public.
19. Direct URL learn — paywall **SUPPORTED**.
20. UI-hidden shorts URL — EmptyGuide **SUPPORTED** (not 403).
21. Expired sub learn URL — `expired` message **SUPPORTED**.
22. Past ended lesson — watch if sub **SUPPORTED**.
23. Future scheduled — not_started **SUPPORTED**.
24. Two devices live — no device limit **SUPPORTED** (two peers). Memory rooms per process.
25. Duplicate payment — two rows **SUPPORTED**.
26. Duplicate enrollment — upsert same course **SUPPORTED**; unique constraint.
27. Duplicate attendance — unique upsert **SUPPORTED**; joinedAt not updated.

## 12.3 Documentation vs code

### README.md
DOCUMENTATION SAYS: demo logins `demo1234`, emails listed; seed for development.
CODE: seed blocked in production; those users only if seed ran.
DEVIATION: none if local seed.

### SETUP.md
SAYS: production IP `3.79.57.253`.
CODE/rules: `3.65.92.39`.
DEVIATION: IP mismatch.

SAYS: Google OAuth, Resend.
CODE: matches optional.

### TDYU_Live_TZ.md
SAYS: `/` catalog chip+grid; Inter; YouTube DNA; Payme/Click later; attendance when watching; 1-tarif sees recording after Mux webhook.
CODE: marketing `/`; different fonts; demo payme UI; attendance on page open; recording also local webm independent of Mux.
DEVIATION: catalog, fonts, attendance definition.

SAYS: “Topshiriq navbati 3-tarif birinchi”.
CODE: sort only.

### DESIGN.md
SAYS: Taste/Vercel guidelines, Playwright landing smoke.
CODE: `e2e/landing.spec.ts` exists (hero+nav only).

### AGENTS.md / lexify.mdc
SAYS: do not touch open.okina.uz; local 3000; lexify.zonic.fit.
CODE: consistent comments. Docker still named opentsul.

### .env.example
SAYS: Redis unused; Mux optional demo.
CODE: matches. Omits CRON_SECRET, TELEGRAM_WEBHOOK_SECRET (used in code).

### Privacy
SAYS: delete account via contact.
CODE: **no** account deletion API.

## 12.4 Git / evolution (from migrations + remnants, not `git log`)

`git log` dump: **UNKNOWN** in this extraction (command output not captured).

From `prisma/migrations`:

1. `20260324120000_init` — initial
2. `20260909100000_lms_pivot` — dropped YouTube-clone (`videos`, `shorts`, `playlists`, `watch_history`, …); created LMS
3. `20260914120000_lesson_plan_fields` — lesson plan fields
4. `20260916100000_password_reset_tokens`
5. `20260918120000_lesson_lobby` — added `lobby` status

Remnants: `ot-theme`, `ot-search-history`, docker `opentsul-*`, repo `TDYU-Live`, `globalThis.__tdyuLiveRooms`.

## 12.5 TODO / FIXME / DEMO / MOCK

Grep `TODO|FIXME|HACK|NOT IMPLEMENTED|PLACEHOLDER|COMING SOON` in `*.ts,tsx,js,md`: **no matches**.

| FILE | MEANING | PRODUCTION IMPACT |
|------|---------|-------------------|
| `src/app/api/payments/demo/route.ts` | only payment writer | no real money |
| `CheckoutClient.tsx` | Payme/Click as demo | misleading if user ignores fine print |
| `src/lib/mux.ts` | demo_* streams without tokens | live is WebRTC anyway |
| `learn/[id]/page.tsx` player-demo | placeholder when no VOD | |
| `SettingsForm` copy | profile edit later | cannot change email/password in UI |
| Seed `muxVodPlaybackId: demo_vod_intro` | not playable (`hasPlayableRecording` false) | seed “ended” lesson shows waiting |

END OF PART 12


==================================================
SOURCE FILE: docs\audit\13-final-handoff.md
==================================================

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
