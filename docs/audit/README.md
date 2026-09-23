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
