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

## Run

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

## CI

`npm run test:e2e` is the future-safe command. **Do not gate deploy on E2E until the suite is stable.** No GitHub Actions workflow was added/changed for this foundation.

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

- Role / course / lesson smokes are **skipped** until `E2E_DB_READY=1` (schema must match Prisma)
- Role tests also **skip** when `E2E_*` credentials are unset
- Course/lesson smoke depends on seed (or env overrides); `npm run db:seed` currently fails without `entitlements` table — use `npm run db:e2e-seed` only as a local fixture helper
- `/search` is authenticated — public suite only asserts redirect to login
- Checkout V2 / live / refund / certificate flows are **not** covered yet
- Chromium only (Desktop Chrome project)
- Monitor does not auto-fail on 401/403 (by design)

## Known application gaps discovered during foundation work

Documented only — not fixed here (schema/Checkout V2 track owns them):

1. Prisma model `Entitlement` / table `entitlements` is in schema but not created by applied migrations → `npm run db:seed` fails
2. Prisma field `User.lastLoginAt` (`users.last_login_at`) is in schema but not in migrations → credentials login throws and surfaces as failed sign-in
3. Prisma field `Lesson.recordingUrl` (`lessons.recording_url`) missing from applied DB → course/lesson pages can 500
