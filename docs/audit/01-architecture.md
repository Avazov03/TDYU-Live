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
