# Lexify — Staging Environment Plan

**Status:** PLAN ONLY — no provision, no DNS, no deploy, no DB create  
**Date:** 2026-09-23  
**Authority context:** Phase 2 shadow access must not run on production  
**Production (do not modify in this plan’s implementation without separate approval):**
- Host: `lexify.zonic.fit`
- App dir: `/var/www/tdyu-live`
- PM2: `tdyu-live` (app), `lexify-telegram` (bot — production path in `ecosystem.telegram.cjs`)
- DB: production PostgreSQL (URL never in repo)

---

## 0. Staging goal

Staging exists to safely run:

- Phase 2 Enrollment **shadow** access (`FF_ENROLLMENT_ACCESS_MODE=shadow`)
- OLD vs NEW access comparison logs
- migration / backfill **dry-runs** (never `--apply` against prod)
- future commerce, live, recording tests
- E2E / regression

**Hard rule:** staging **must never** share the production database or write to it.

Default on staging after first boot: `FF_ENROLLMENT_ACCESS_MODE=off`. Shadow only after staging smoke PASS + explicit approval.

---

## 1. Infrastructure options (realistic for this repo)

Sources of truth: `SETUP.md`, `README.md`, `docker-compose.yml`, `.env.example`, `.gitignore` (deploy scripts listed but **not** in tree), `ecosystem.telegram.cjs`, Cursor rules (`lexify.zonic.fit` / Lightsail / PM2), audit `docs/audit/01-architecture.md`.

| Option | Complexity | Isolation | Deploy complexity | DB isolation | Env isolation | Rollback | Cost | Ops risk | Suitability |
|--------|------------|-----------|-------------------|--------------|---------------|----------|------|----------|-------------|
| **A. Same Lightsail, isolated process + isolated DB** | Low–medium | Medium–high if dirs/ports/DB/env fully split | Medium (mirror prod PM2 pattern; scripts missing in repo) | High if separate DB/role | High if separate `.env` + PM2 name | Easy (stop staging PM2; leave prod) | Low (same VM) | Medium (shared host CPU/RAM/disk; misconfig risk) | **High** — matches current prod ops model (PM2 on Lightsail); no new host type |
| **B. Separate Lightsail instance** | Medium–high | Highest | Higher (new box, SSH, nginx, SSL, PM2) | Highest | Highest | Easy (isolate whole VM) | Higher (2nd instance + static IP optional) | Lower blast radius | High if budget/ops allow; not required by repo |
| **C. Docker-based staging (app+DB)** | Medium | High if dedicated compose project | Medium–high — **no app Dockerfile today**; only Postgres+Redis compose | High | High | Easy (`compose down`) | Low–medium on same or other host | Medium (new runtime model vs prod PM2) | Medium — DB compose exists; **app container not in repo** → would need new packaging |
| **D. Cloud DB + separate app host** | Medium | High (DB) / depends on host | Medium (Neon/Supabase already documented as local/cloud option in SETUP) | Highest for DB | High | Easy for DB (point `DATABASE_URL` back) | Cloud DB fees + host | Low DB risk if credentials scoped | High for **DB side**; app host still needs A or B |
| **E. Other existing supported** (Vercel preview, GitHub Actions preview, Fly/Railway) | — | — | — | — | — | — | — | — | **Not present** — no workflows, no `vercel.json`/Fly/Railway configs; `.vercel` only in `.gitignore` |

**Objective fit (not a “best” award):** this repository’s **documented production shape** is Lightsail + PM2 + Node, with Docker used for **local Postgres/Redis only**. Therefore **Option A** (or **A + D** for DB) is the path that reuses existing operational knowledge without inventing unsupported platforms. Option C requires **new** app containerization first. Option B is valid when stronger host isolation is required.

---

## 2. Production isolation boundaries

| Concern | Production | Staging (required) |
|---------|------------|-------------------|
| Hostname | `lexify.zonic.fit` | Separate hostname (proposed below) |
| App directory | `/var/www/tdyu-live` | Separate dir, e.g. `/var/www/tdyu-live-staging` |
| Process | PM2 `tdyu-live` (port **3100** per rules) | Separate PM2 name + **different port**, e.g. `tdyu-live-staging` on **3101** |
| Database | Production Postgres | Separate database (and preferably separate role); **never** prod `DATABASE_URL` |
| Env files | Server-only `.env` (not in git) | Separate server-only `.env.staging` / dir `.env` — **never** commit; **never** copy prod secrets into repo |
| Logs | Prod PM2 / nginx logs | Separate PM2 log streams / log files |
| Migrations | Prod `_prisma_migrations` | Staging DB’s own migration history |
| Uploads | Prod `public/uploads` | Separate uploads root or staging-only volume |
| Telegram bot | Prod `lexify-telegram` → prod cwd | **Do not** point staging at prod bot; disable or use staging-only bot token |
| Credentials in git | Forbidden | Forbidden |

---

## 3. Domain (proposal only — no DNS change in this task)

| Item | Proposal |
|------|----------|
| Hostname | `staging.lexify.zonic.fit` |
| DNS | `A` (or `CNAME`) for `staging` → staging host public IPv4 (same Lightsail IP if Option A; new IP if Option B) |
| HTTPS | Let’s Encrypt (or existing certbot pattern on server) for `staging.lexify.zonic.fit` |
| Reverse proxy | Nginx (or current prod proxy) server block: `server_name staging.lexify.zonic.fit` → `proxy_pass http://127.0.0.1:3101` (example port) |
| Auth URLs | Staging `AUTH_URL` / `NEXTAUTH_URL` = `https://staging.lexify.zonic.fit` |
| Google OAuth | Separate redirect URI for staging callback (or staging omitted from Google until needed) |

**Do not** change DNS until implementation is approved.

---

## 4. Database strategy (design only — do not create yet)

### Requirements

- Staging `DATABASE_URL` ≠ production
- Independent Prisma migration history
- No production write access from staging app role
- No automatic production data mutation
- No raw production dump as default

### Viable patterns

| Pattern | Notes |
|---------|--------|
| **Dedicated DB on same Postgres server** | New database name + staging-only role with grants only on that DB. Lowest cost on Option A. Risk: shared Postgres process (mis-grant). Mitigate with role privileges. |
| **Dedicated Postgres instance / container on same host** | Better process isolation; map different host port; never publish publicly. |
| **Cloud Postgres (Neon/Supabase)** | Matches SETUP “Variant B”; strong isolation; good for Option A app + D DB. |

**Recommended design shape for Lexify (compatible):**  
App on Option A **or** B + **staging-only** Postgres (same-server new DB **or** cloud). Prefer **staging DB role cannot CONNECT to production database**.

Migration: `npm run db:migrate:deploy` against staging URL only. Rollback: prefer **forward-fix** migration or restore **staging** backup — not production restore.

---

## 5. Data strategy

| Approach | Pros | Cons | Fit for shadow / access tests |
|----------|------|------|-------------------------------|
| **A. Synthetic fixture** (`db:phase2:fixture` / `db:seed`) | No PII; deterministic; already in repo | Not prod volume/shape | **Primary for Phase 2 shadow** |
| **B. Sanitized production snapshot** | Realistic volume | PII/payment risk; sanitization pipeline missing in repo; easy to do wrong | **Deferred** until explicit sanitizer + legal/ops approval |
| **C. Dedicated staging seed** | Tailored scenarios (multi-course, expired, orphan entitlement, closed enrollment) | Extra maintenance | **Extend A** as staging seed profile |

**Decision for first staging:** **A + C** — synthetic / dedicated staging seed covering:

- active subscription  
- expired subscription  
- multi-course student  
- entitlement orphan  
- payment present / absent  
- teacher + admin  
- lessons (scheduled / live / ended + recording metadata fields)  
- (later) Enrollment rows for shadow MATCH cases after **approved** staging-only backfill dry-run → apply **on staging DB only**

**Forbidden:** raw prod dump; committing dumps; using prod payment provider credentials for live charges.

---

## 6. Environment variables (names only)

### Application
`NODE_ENV`, `AUTH_URL`, `NEXTAUTH_URL`, `NEXT_PUBLIC_SITE_URL` (if used)

### Database
`DATABASE_URL` (**staging-only**)

### Auth
`AUTH_SECRET` (**staging-specific**), `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` (optional; staging redirects), `SUPER_ADMIN_EMAIL`

### Email
`RESEND_API_KEY`, `EMAIL_FROM` — prefer **unset** or staging sink; never prod campaign lists

### Mux
`MUX_TOKEN_ID`, `MUX_TOKEN_SECRET` — prefer **unset** (demo mode) or Mux **test** credentials if available

### Telegram
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` — prefer **unset** on staging app; do not run prod poller against staging; if needed, **separate** bot

### Redis
`REDIS_URL` — optional; unused in app today; if set, staging-only Redis DB index/instance

### Cron
`CRON_SECRET` — staging-only; do not share prod cron callers hitting staging accidentally without intent

### Feature flags (staging defaults)
```
FF_ENROLLMENT_ACCESS_MODE=off
FF_ENROLLMENT_ACCESS=false   # compat
FF_COURSE_CHECKOUT_V2=false
FF_DISABLE_TARIFF_UI=false
FF_DISABLE_ONBOARD_ENROLL=false
FF_LIVE_WAITING_ROOM_V2=false
FF_LIVE_SHARED_ROOMS=false
FF_RECORDING_REVIEW_24H=false
FF_REFUNDS_V1=false
```

Shadow enablement is a **separate** approved step after smoke.

### Seed
`ALLOW_SEED` — staging may allow seed when `NODE_ENV` is not production, or run fixture scripts explicitly; never seed production.

---

## 7. Deployment (known vs missing)

### Known

- Prod: Lightsail, path `/var/www/tdyu-live`, PM2 `tdyu-live`, port 3100, domain `lexify.zonic.fit`
- App: Next.js `npm run build` / `npm start` (or PM2 wrapping Node)
- Git remote: `manba` → `TDYU-Live` `main`
- Telegram ecosystem file points at **production** cwd
- Local DB via `docker compose` (Postgres + Redis)
- `.gitignore` lists local deploy helpers: `scripts/deploy*.py`, `scripts/fix_deploy.py`, `scripts/upload_deploy_once.py`, …

### Missing (do not invent)

- Actual deploy script contents (gitignored / not in workspace)
- Exact nginx site config
- Exact production Postgres layout (local vs remote)
- Whether a second app port is already reserved
- SSL automation details beyond certbot mentions in audits

### What must be manually configured (first staging build)

1. Staging directory + Node install + `git pull` of approved commit  
2. Staging `.env` on server (not in git)  
3. Staging Postgres + `db:migrate:deploy`  
4. Staging seed/fixture  
5. PM2 process `tdyu-live-staging` on non-prod port  
6. Nginx + DNS + TLS for staging hostname  
7. Smoke checklist  
8. Only then consider `FF_ENROLLMENT_ACCESS_MODE=shadow`

### Eventually

- Controlled deploy process (script or CI) with **explicit** `TARGET=staging|production`  
- No credentials in git; secrets only on server / secret store  
- Documented runbook in `docs/infrastructure/` (this file is the plan)

---

## 8. Security

Staging must not:

- Hold or log production DB credentials  
- Send real student emails/Telegram as if prod  
- Charge real payments (keep demo / no provider keys)  
- Accept prod Mux/Telegram webhooks aimed at prod URLs  
- Write production DB  
- Share prod `AUTH_SECRET` (session cross-env risk)

| Integration | Staging approach |
|-------------|------------------|
| Telegram | Unset token; do not start prod `lexify-telegram` against staging; optional dedicated staging bot |
| Mux | Unset → demo; or test credentials |
| Email / Resend | Unset or clearly staging `EMAIL_FROM`; no student blasts |
| Cron | Staging-only secret; do not point prod crontab at staging unless intentional |
| OAuth | Staging callback URL registered only when needed |
| Uploads | Separate disk path; no symlink to prod uploads |

---

## 9. Observability (minimum)

| Signal | Where |
|--------|--------|
| App stdout/stderr | PM2 logs for `tdyu-live-staging` |
| Migration logs | Captured output of `db:migrate:deploy` on staging |
| Shadow mismatches | App logs `[access-shadow]` JSON lines when mode=`shadow` |
| Errors | PM2 error log + Next error overlay disabled in prod-like `NODE_ENV` |
| Health | HTTP `GET https://staging…/` and `/login` return success; optional simple `/api/health` later (not required to invent now) |

No new SaaS monitoring required unless already present (none found in repo).

---

## 10. Rollback

| Layer | Strategy |
|-------|----------|
| App | PM2 restart previous release directory/symlink or `git checkout` previous commit + rebuild; keep prod untouched |
| Migration | Prefer additive-only on staging; if bad migration, restore **staging** DB from staging backup or recreate staging DB from migrations + seed — **not** production rollback |
| Environment | Revert staging `.env` flag to `off`; remove shadow |
| DNS | Remove or point staging record away; prod DNS unchanged |
| Default | **Do not** use destructive DB rollback as default |

---

## 11. Cost / operations (practical, no purchase)

| Component | Need |
|-----------|------|
| Staging hostname + TLS | DNS + certbot time |
| Staging app dir + Node build | Disk + RAM on existing or new VM |
| Staging Postgres | Same-server DB **or** small cloud Postgres |
| Staging PM2 process | Extra ~same memory order as one Next instance |
| Ops | Short runbook; who may set `shadow`; who deploys |

No automatic provisioning in this plan.

---

## 12. Prerequisites before implementation

Owner / ops must confirm:

1. **Architecture choice:** A, A+D, or B (and whether app Dockerization is explicitly wanted — currently unsupported without new work).  
2. **Hostname** approval: `staging.lexify.zonic.fit` (or alternative).  
3. **Server capacity** (if A): free RAM/disk/port for second Node process + staging DB.  
4. **Where staging Postgres lives** (same instance new DB vs cloud).  
5. **Who creates DNS + TLS + nginx** (manual ops).  
6. **Deploy method** for first cut: manual SSH pull/build until deploy script is available under controlled review (do not commit secrets).  
7. **Data:** start with fixture/seed only (no prod snapshot).  
8. **External services:** Telegram/Mux/email disabled or staging-only.  

Missing info that does **not** block planning but blocks **blind** automation: contents of gitignored deploy scripts, exact nginx/Postgres topology.

---

## 13. Implementation phases (when approved — not now)

1. Create staging DB + role (no prod data).  
2. Create app dir + env (`mode=off`).  
3. Migrate + seed/fixture.  
4. PM2 + nginx + DNS + TLS.  
5. Smoke (login, student legacy access, lesson, admin load).  
6. Report **READY TO ENABLE NON-PROD SHADOW**.  
7. Separate approval → set `FF_ENROLLMENT_ACCESS_MODE=shadow` only.

---

## Final plan status

**READY TO BUILD STAGING** — superseded by build execution (2026-09-23).

## Build status (Option A executed)

| Item | Value |
|------|--------|
| App path | `/var/www/tdyu-live-staging` |
| PM2 | `tdyu-live-staging` |
| Port | `3101` (local smoke) |
| DB | `tdyulive_staging` / role `tdyulive_staging` @ `127.0.0.1:5432` |
| Commit | `d6ed9f26183a65881efc32c9fe52b61f9026120e` |
| Flags | `FF_ENROLLMENT_ACCESS_MODE=off` |
| Nginx | config in `sites-available` only — **not** enabled |
| DNS | `staging.lexify.zonic.fit` **not** created yet |
| HTTPS | pending DNS + certbot |
| Shadow | **not** enabled |

**Required DNS (manual):** `A` record `staging.lexify.zonic.fit` → `3.65.92.39`  
Then enable nginx site + `certbot --nginx -d staging.lexify.zonic.fit`.

**Residual risk:** same Postgres cluster; staging role may `CONNECT` to prod DB via `PUBLIC` but has **no** table privileges (SELECT denied). Prefer later revoke of `PUBLIC CONNECT` on prod (separate approved change) or move staging DB to dedicated instance.
