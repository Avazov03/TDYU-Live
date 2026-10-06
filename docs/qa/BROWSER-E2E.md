# Browser E2E (Playwright)

Lexify browser-level end-to-end tests open a real Chromium window (headless by default), click, fill forms, and assert UI + critical browser/network failures.

This is **not** the same as unit/service tests:

| Layer | Command | What it proves |
| --- | --- | --- |
| Unit / service | `npm run test:access`, `npm run test:checkout-v2` | Pure logic (access, checkout helpers) without a browser |
| Typecheck | `npm run type-check` | Types compile |
| **Browser E2E** | `npm run test:e2e` | Real UI flows in Chromium |

## Framework

- **Playwright** (`@playwright/test`) — already in the repo; do not add Cypress/Webdriver in parallel.
- Config: `playwright.config.ts`
- Specs: `e2e/` (landing + `e2e/smoke/`)
- Shared fixtures: `e2e/fixtures/`
- Auth helper: `e2e/auth/login.ts`
- Smart error monitor: `e2e/helpers/browser-monitor.ts`

## Install browsers (once)

```bash
npx playwright install chromium
```

## Hermetic full run (recommended, same as CI)

One command, no staging, no tunnel, no hand-set env. Needs Docker and `npx playwright install chromium`:

```bash
npm run test:e2e:full
```

`scripts/e2e-hermetic.ts` does: throwaway Postgres (`docker-compose.e2e.yml`, port 54329, tmpfs) → `prisma migrate deploy` → `scripts/e2e-hermetic-seed.ts` (every fixture the specs use; refuses any DB not named `*_e2e`) → `next build` → `next start` on **:3200** → all Playwright projects → stop server and container.

- Environment comes **only** from `e2e/hermetic.env` (test values, committed). Local `.env` / `.env.production.local` are not loaded (`__NEXT_PROCESSED_ENV`), so real Mux/Gemini keys never reach the run; matching shell variables (`E2E_*`, `FF_*`, `MUX_*`, …) are dropped.
- Runs everything except `live/mux-playback.spec.ts`, which needs real Mux credentials (staging only).
- Flags: `--skip-build`, `--keep-db`, `--no-docker`, or the env vars `E2E_FULL_SKIP_BUILD=1`, `E2E_FULL_KEEP_DB=1`, `E2E_FULL_NO_DOCKER=1`. Other arguments go to `playwright test`. PowerShell drops `--`, so there use the env vars or `npx tsx scripts/e2e-hermetic.ts --skip-build e2e/access`.
- Windows builds use `--webpack` and retry up to 3 times on the sporadic native crash (`0xC0000005`).
- CI: `.github/workflows/ci.yml` runs lint, type-check, unit suites, then this command on every push to `main` and every PR; the Playwright report is uploaded when it fails.

## Run against an existing server

```bash
# Headless Chromium (starts `npm run dev` if nothing is on :3000)
npm run test:e2e

# Smoke + landing only
npm run test:e2e:smoke

# Interactive UI mode
npm run test:e2e:ui

# Headed browser
npm run test:e2e:headed

# Open last HTML report
npm run test:e2e:report
```

## Environment variables

| Variable | Purpose |
| --- | --- |
| `TEST_BASE_URL` | Target app (preferred). Default `http://localhost:3000` |
| `PLAYWRIGHT_BASE_URL` | Alias of `TEST_BASE_URL` (legacy) |
| `E2E_STUDENT_EMAIL` / `E2E_STUDENT_PASSWORD` | Student UI login |
| `E2E_TEACHER_EMAIL` / `E2E_TEACHER_PASSWORD` | Teacher UI login |
| `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` | Admin UI login |
| `E2E_COURSE_ID` | Optional published course UUID |
| `E2E_LESSON_ID` | Optional lesson UUID |
| `E2E_CHECKOUT_V2_ENABLED` | Opt-in gate for future Checkout V2 browser tests |
| `E2E_DB_READY` | Opt-in for role/course/lesson smokes when DB schema matches Prisma |
| `E2E_FIXTURE_RESET_TOKEN` | Required by live/recording suites; must equal the target server's `E2E_FIXTURE_RESET_TOKEN` |

### Stateful suites: fixture reset (`e2e/live`, `e2e/recording`)

Live and recording specs start, end and publish shared fixture lessons (`d2500001-…-045`…`050`). Each spec resets its own lesson through `POST /api/e2e/fixture-reset` before every test and again in `afterAll`, so reruns and runs after a crash start from the same state:

- the E2E-owned lesson returns to `scheduled` (start 5 minutes ago), its recordings, recording files, live sessions, attendance intervals and legacy-migration audit rows are removed;
- any other fixture-teacher lesson still in lobby/live/paused is ended, open live sessions are ended and open attendance intervals are closed.

The endpoint answers 404 unless the server has `E2E_FIXTURE_RESET_TOKEN` (24+ chars) and is not production-like (`isProductionLikeEnv`). It only touches the fixture teacher (`a3333333-…-301`) and the owned lesson ids. Never set the token on production.

These specs run in the `live-serial` Playwright project with one worker: schedule rules allow one running lesson per teacher, and every spec uses the same fixture teacher.

`playwright.config.ts` loads `.env` via `dotenv`.

**Production hosts are refused** (`lexify.zonic.fit`, `www.lexify.zonic.fit`, `open.okina.uz`).

**Staging allowlist:** `staging.lexify.zonic.fit` is explicitly allowed. Other `*.lexify.zonic.fit` hosts are refused until added to `STAGING_HOST_ALLOWLIST` in `e2e/helpers/env.ts`.

### Schema gate (`E2E_DB_READY`)

Public landing/login smokes always run. Student / Teacher / Admin / course-detail smokes require `E2E_DB_READY=1` because the Prisma schema is currently ahead of some applied migrations (examples discovered during this work: missing `users.last_login_at`, `entitlements` table, `lessons.recording_url`). Do not set this flag until the target DB is aligned — otherwise you get real 500s / failed logins, not flaky selectors.

Local fixture helper (does **not** fix migrations; skips Entitlement):

```bash
npm run db:e2e-seed
```

### Staging synthetic accounts (Phase 2 fixtures)

Staging DB (`tdyulive_staging`) has deterministic `@lexify.local` users. Password for all listed accounts: **`demo1234`** (synthetic only — never production).

| Role | Email | User id |
| --- | --- | --- |
| Student | `fixture.active1@lexify.local` | `a6666666-6666-6666-6666-666666666611` |
| Teacher | `fixture.teacher@lexify.local` | `a6666666-6666-6666-6666-666666666602` |
| Admin | `staging.admin@lexify.local` | `a6666666-6666-6666-6666-666666666699` |

| Entity | Id / value |
| --- | --- |
| Course | `a4444444-4444-4444-4444-444444444401` — *Fixture Course A* |
| Enrollment (active1) | `7a0499ee-d997-4e83-8481-86306db81433` |
| Lesson | `a5555555-5555-5555-5555-555555555501` — *Fixture ended lesson* |
| Subscription (My Courses list Still uses Subscription) | `03bedf1d-41e8-4c3a-976e-953b0cbac1cd` on Course A |

Copy `.env.e2e.staging.example` values into your shell. Reach staging app via SSH tunnel (port 3101 is not public by default):

```bash
ssh -i .secrets/tdyu-live-server.pem -L 3101:127.0.0.1:3101 -N ubuntu@3.65.92.39
```

Then:

```bash
# PowerShell example
$env:TEST_BASE_URL="http://127.0.0.1:3101"
$env:E2E_DB_READY="1"
$env:E2E_STUDENT_EMAIL="fixture.active1@lexify.local"
$env:E2E_STUDENT_PASSWORD="demo1234"
$env:E2E_TEACHER_EMAIL="fixture.teacher@lexify.local"
$env:E2E_TEACHER_PASSWORD="demo1234"
$env:E2E_ADMIN_EMAIL="staging.admin@lexify.local"
$env:E2E_ADMIN_PASSWORD="demo1234"
$env:E2E_COURSE_ID="a4444444-4444-4444-4444-444444444401"
$env:E2E_COURSE_TITLE="Fixture Course A"
$env:E2E_LESSON_ID="a5555555-5555-5555-5555-555555555501"
$env:E2E_LESSON_TITLE="Fixture ended lesson"
npm run test:e2e:smoke
```

If `https://staging.lexify.zonic.fit` DNS/TLS is live, you may set `TEST_BASE_URL` to that origin instead of the tunnel.

### Deterministic seed IDs

From `prisma/seed.ts` (override with `E2E_COURSE_ID` / `E2E_LESSON_ID` if needed):

- Course: `44444444-4444-4444-4444-444444444401` — *Fuqarolik huquqi: asoslar*
- Lesson: `55555555-5555-5555-5555-555555555501` — *Kirish: fuqarolik huquqi tizimi*
- Student is enrolled on that course via Subscription

If seed data is missing, role/course tests **skip or fail clearly** — they do not invent DB rows.

## Local vs staging

- **Local (preferred):** `TEST_BASE_URL` unset → Playwright starts/reuses `npm run dev` on `:3000`.
- **Staging:** `TEST_BASE_URL=https://staging.lexify.zonic.fit` (allowlisted) plus dedicated staging `E2E_*` accounts. Never production (`lexify.zonic.fit`).
- **Local staging port:** `TEST_BASE_URL=http://127.0.0.1:3101` if tunneling to the staging PM2 process over SSH.

When `TEST_BASE_URL` / `PLAYWRIGHT_BASE_URL` is set, Playwright does **not** start a local webServer.

## Artifacts on failure

Configured in `playwright.config.ts`:

- Screenshot — `only-on-failure`
- Video — `retain-on-failure`
- Trace — `retain-on-failure` (available even when retries=0)
- HTML report — `playwright-report/`
- Raw output — `test-results/`
- Each test attaches `browser-diagnostics` (text): page URL, last action, critical console/API issues

```bash
npm run test:e2e:report
# or
npx playwright show-report
npx playwright show-trace test-results/.../trace.zip
```

## Smart error detection

`BrowserMonitor` + fixture `monitor`:

**Critical (fail the test):**

- `pageerror` / uncaught exceptions
- Application `console.error` (after noise filters)
- Same-origin HTTP **5xx**
- Failed same-origin `/api/*` requests (excluding aborts)

**Non-critical (recorded, do not fail):**

- Favicon / apple-touch-icon
- Analytics / common third-party trackers
- Blocked-by-client / aborted navigations
- HTTP **401/403** (role isolation may be expected — assert explicitly in the test if needed)

Call pattern: fixtures attach the monitor automatically and assert no critical errors after a **passing** test body. Role tests use `studentPage` / `teacherPage` / `adminPage`.

## Feature flags

| Flag | E2E stance |
| --- | --- |
| `FF_COURSE_CHECKOUT_V2` | Leave **false**. Do not enable from this suite. |
| `FF_ENROLLMENT_ACCESS_MODE=shadow` | Do not change. Tests use current enrollment UX. |
| `E2E_CHECKOUT_V2_ENABLED` | Future opt-in for a Checkout V2 browser describe; still skipped until implemented. |

## Auth fixtures

```ts
import { test, expect } from "../fixtures";

test("Student can open My Courses", async ({ studentPage }) => {
  await studentPage.getByRole("link", { name: "Kurslarim" }).first().click();
  await expect(studentPage).toHaveURL(/\/my-courses/);
});
```

Login is UI-based (`/login` → Email / Parol → Kirish → `/go` redirect). No production passwords in code.

## Current smoke coverage

**Always on (no DB gate):**

- Landing hero + navbar
- Homepage loads without critical browser errors
- Login page loads
- Unauthenticated `/search` → login

**Gated by `E2E_DB_READY=1` + credentials + fixtures:**

- Course detail (seed id)
- Student: login, dashboard, My Courses, enrolled course, lesson, navigate back, search
- Teacher: login, teacher dashboard
- Admin: login, admin dashboard

**Checkout V2:** placeholder, skipped

## Enrollment-authoritative access suite (`e2e/access`)

Included in `npm run test:e2e:full`. Against staging it needs `FF_ENROLLMENT_ACCESS_MODE=enrollment` and the access fixtures (`scripts/lib/e2e-access-seed.ts`). Refresh them after pulling new scenarios (idempotent; refuses any DB not named `*_staging` unless it is a local dev DB):

```bash
cd /var/www/tdyu-live-staging && npx tsx scripts/e2e-access-fixtures.ts
```

Run with `E2E_DB_READY=1 E2E_ENROLLMENT_AUTHORITATIVE=1` plus the student and teacher credentials:

```bash
npm run test:e2e:access
```

| Test | Fixture (fixture.active1) | Expected |
|------|---------------------------|----------|
| A | Course A, active seat — My Courses → Course → Lesson | page open, chat API 200 |
| E/F/L | Deny probe course, no seat | paywall, chat 403, no media |
| G/K | Course A + second active seat (Access Fixture Second Active Course) | both open |
| B/H/I | Completed course, completed seat, legacy subscription expired | replay open |
| D | Refunded seat (`accessOpen=false`) | paywall, chat 403 |
| C | Cancelled seat (`accessOpen=false`) | paywall, chat 403 |
| J | Active legacy subscription (t3), no seat | paywall, chat 403 |
| M | Teacher uploads a `.txt` material to Course A and to the deny probe lesson (deleted afterwards) | teacher 200 on both, student 200 on Course A / 403 on deny probe, anonymous 401 |
| L (anonymous) | Course A lesson without a session | login paywall, APIs 401 |

API statuses are probed from a second, unmonitored tab: the session cookie is `Secure`, so only the browser sends it to `http://127.0.0.1:3101`, and expected 4xx answers must not count as console errors.

## Mutating flows (`e2e/flows`, hermetic only)

Gated by `E2E_FLOWS=1` (set in `e2e/hermetic.env`). They change data, so they run only against the throwaway hermetic DB, seeded by `scripts/lib/e2e-flow-seed.ts` (IDs `f2700001-…`, users `fixture.{refund1,cancel1,assign1,assign2,cert1,teacher2}@lexify.local`, see `FLOW_FIXTURES`). Every role gets its own monitored browser context (`e2e/flows/flow-helpers.ts`).

| Flow | Browser path | Server-side checks |
|------|--------------|--------------------|
| Admin 50% refund | `/admin/payments` → "50% qaytarish" (33% watched) → reason → "50% qaytarilgan", 100 000 so'm | student 403 on the refund API, repeat 409, legacy purchase 409; refunded course leaves My Courses, lesson paywalled, chat 403; the student's other course stays |
| Teacher cancels upcoming course | studio card → "Kursni bekor qilish" → reason → "Bekor qilingan" | student 403; admin sees "Kurs bekor — 100% qaytarilgan", 150 000 so'm; course leaves My Courses |
| Assignment | teacher creates → student submits text + PDF → teacher grades 87 + note → student sees grade | outsider submit 403; file: teacher/submitter/admin 200, classmate/other student/other teacher 403, anonymous 401; other teacher grade 404; create on foreign course 404, student 403 |
| Course completion | studio card → "Kursni yakunlash" → "Yakunlangan" | student sees the course as completed |
| Certificate | `/teacher/group` → issue PDF → student views/downloads → teacher revokes with reason | non-PDF 422, student without seat 409, repeat 409; file: owner/teacher/admin 200, others 404, anonymous 401; other teacher revoke 404; after revoke the student loses card + file (404); admin table and teacher view show the reason; page has no duplicate ids |
| Ops alert route | — | `POST /api/admin/ops/test-alert`: admin 500 (deliberate), student/anonymous 403, app keeps serving |

## Production error alerts

`src/instrumentation.ts` (`onRequestError`) → `src/lib/ops-alert.ts` sends every server 500 to Telegram: recipients are `OPS_ALERT_TELEGRAM_CHAT_IDS` or, if unset, admins with a linked Telegram chat. If nobody is reachable on Telegram the alert is emailed (Resend) to `OPS_ALERT_EMAILS` or every admin. On by default only in production (`OPS_ALERTS=0|1` overrides). Rules live in `src/lib/ops-alert-policy.ts` (unit-tested in `test:security`): secrets and query strings are redacted, Next control-flow errors ignored, one alert per route+message per 10 min (repeats counted), at most 20 per hour. Verify the chain on production as admin: `POST /api/admin/ops/test-alert` (logs `{"scope":"ops","event":"alert_sent",…}` or `alert_no_recipients`).

## Page health (`e2e/health`, `e2e/helpers/page-health.ts`)

Every main page of every role (public, student, teacher incl. the open assignment form, all admin pages) is checked for horizontal overflow, duplicate ids, buttons/links without an accessible name, form fields without a label and images without alt. Checks are soft, so one failure lists all problems of all pages with selector hints (e.g. `input[Qidiruv]`, `a.flex.items-center[/schedule]`). Visibility uses `checkVisibility()`, so content of closed `<details>` and hidden drawers is not reported.

## Mobile project

Playwright project `mobile` (Pixel 7, Chromium engine) re-runs `e2e/mobile`, `smoke/public`, `shell` and `catalog`. `e2e/mobile/layout.spec.ts` runs the page-health checks on public and student pages at phone width and checks the drawer reaches navigation.

## CI and deploy gate

`.github/workflows/ci.yml` — job `checks` (lint, type-check, unit suites) then job `e2e` (`npm run test:e2e:full`, all projects). See "Hermetic full run" above.

Before a production deploy run `npm run ci:gate` (or `npx tsx scripts/require-green-ci.ts <sha> --wait`): it exits non-zero unless the CI workflow succeeded for that commit. While the workflow is not on GitHub (or `gh` is unavailable) it accepts a local stamp instead: a full `npm run test:e2e:full` (no spec filter, no `--skip-build`) on a clean tree writes `.e2e-stamps/<sha>.json`. A failed CI run is never overridden by a stamp.

## Phase 2.3C foundation status

Validated:

- Intentional failure produces screenshot + video + trace + `browser-diagnostics` attachment
- Intentional-fail spec removed; smoke suite green (public + landing always-on)
- Role/course/lesson smokes skip until `E2E_DB_READY=1` + `E2E_*` credentials
- Staging host allowlist: `staging.lexify.zonic.fit` (production exact host refused)
- Checkout V2 browser test remains placeholder / skipped
- `FF_COURSE_CHECKOUT_V2` and enrollment shadow mode are **not** changed by this suite

## Phase 2.3D role smoke (staging fixtures)

With `.env.e2e.staging.example` values + SSH tunnel to `:3101`:

- **17 passed / 1 skipped** (`npm run test:e2e:smoke`) — only Checkout V2 placeholder remains skipped
- Real UI login for Student / Teacher / Admin (no auth bypass)
- Deterministic course/lesson via `E2E_COURSE_*` / `E2E_LESSON_*` → staging Fixture Course A
- `loginAs` reloads once if the login heading fails to paint (staging static-chunk flake under RAM pressure)
- Staging flags unchanged: `FF_COURSE_CHECKOUT_V2=false`, `FF_ENROLLMENT_ACCESS_MODE=shadow`
- Production app/DB/env/flags untouched

## Debugging

1. Reproduce headed: `npm run test:e2e:headed -- e2e/smoke/student.spec.ts`
2. Open report / screenshot under `test-results/`
3. Read attached `browser-diagnostics`
4. On CI retry failures: `npx playwright show-trace …`

## Known limitations

- Outside `test:e2e:full`, role / course / lesson smokes **skip** until `E2E_DB_READY=1` and the `E2E_*` credentials are set
- `/search` is authenticated — public suite only asserts redirect to login
- Live Mux playback runs only on staging (real Mux credentials)
- Mutating flows (`e2e/flows`) run only in the hermetic suite, never against staging
- Chromium engine only (desktop + Pixel 7 viewport); no Firefox/WebKit
- Monitor does not auto-fail on 401/403 (by design)

## Former application gaps (resolved)

`entitlements`, `users.last_login_at` and `lessons.recording_url` are created by migration `20260924110000_align_legacy_runtime_schema`; the hermetic run migrates an empty DB and logs in, so they are verified on every CI run.
