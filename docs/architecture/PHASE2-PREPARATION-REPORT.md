# PHASE 2 PREPARATION REPORT

**Date:** 2026-09-23
**Scope:** Production-like mapping dry-run + shadow access abstraction
**Forbidden actions not performed:** `--apply`, global flag ON, commerce migrate, live rewrite, legacy delete

---

## A. Data mapping

**PASS** (deterministic on local/demo fixture)

- Subscription `(userId, courseId)` → Enrollment is 1:1 when FKs intact.
- Entitlement orphans are **not** mapped (count reported separately).
- Empty DB correctly reported **BLOCKED** before fixture load.
- This is **not** a production snapshot claim — fixture shapes only.

## B. Production-like dry-run

**Mechanism:** `npm run db:phase2:fixture` then `npm run db:phase2:backfill-dry-run`
**Writes:** none (no Purchase/Payment/Enrollment created)

| Metric | Count |
|--------|------:|
| subscriptionsTotal | 6 |
| subscriptionsActive | 5 |
| subscriptionsExpired | 1 |
| subscriptionWithoutUser | 0 |
| subscriptionWithoutCourse | 0 |
| subscriptionAmbiguousCourseMapping | 0 |
| subscriptionDuplicateTargetEnrollment | 0 |
| entitlementOrphansNoAutoEnroll | 1 |
| wouldCreateEnrollment | 6 |
| enrollmentsExisting | 0 |

**Proposed per mapped sub:** `status=active`, `accessOpen=true` (including expired legacy), `startsAt` from sub, `endsAt` kept as metadata only.

**Purchase/Payment reconstruction:**
- 5/6 can `link_existing_payment`
- 1/6 `legacy_zero_purchase` (no Payment row)
- Must remain optional markers; not authoritative commerce history. Dry-run created **none**.

**Verdict:** `PASS_DETERMINISTIC` on fixture. Production-like **snapshot** dry-run still required before any `--apply`.

## C. Access call graph

Documented in `docs/architecture/PHASE2-ACCESS-SHADOW.md`.

`getLessonAccess` callers (shadow-ready): learn page, live signal, media recording, chat POST.

Independent legacy paths (unchanged this phase): `getActiveSubscription(s)`, `requireStudentCabinet`, `requireAppUser`, home-path, onboard/enroll, cabinet lists, teacher/admin stats.

## D. OLD vs NEW comparison design

| Mode | Default | Behavior |
|------|---------|----------|
| `off` | **yes** | Serve OLD only |
| `shadow` | no | Serve OLD; compute NEW; log `[access-shadow]` MATCH/MISMATCH |
| `dual` | no | Prefer NEW when enrollment row exists; else OLD fallback |

**Files:** `src/lib/enrollment-access.ts`, `src/lib/access.ts`, `src/lib/feature-flags.ts`
Env: `FF_ENROLLMENT_ACCESS_MODE` (preferred); `FF_ENROLLMENT_ACCESS` compat.

Shadow never silently chooses NEW.

## E. Multi-course safety

**PASS** (abstraction)

- NEW seat scoped to `(userId, courseId)` only.
- Tests B/C/D cover two seats + refund isolation.
- Legacy `POST /api/enroll` expire-others **still exists** (not changed) — disable later via flag.

## F. Permanent replay compatibility

**PASS / DEFERRED**

- NEW evaluator does **not** deny via `endsAt`.
- Permanent replay UX / recording publish path **deferred** to recording phase.
- Dependency documented in feature-flags + PHASE2-ACCESS-SHADOW.

## G. Security

**PASS** (for this phase scope)

- Enrollment decisions server-side only.
- No client exposure of Enrollment rows.
- Did **not** “fix” public chat GET / uploads (later security phases).
- `purchaseAllowed` / `isBlocked` not wired into seat evaluator.

## H. Tests

**PASS** — `npm run test:access` (scenarios A–J + completed seat + purchaseAllowed separation)

## I. Required decisions

1. **Production snapshot dry-run** before any backfill `--apply` (fixture ≠ production).
2. When to turn **shadow** on in a non-prod environment (ops choice; code ready, default off).
3. Tariff live parity during dual: currently `applyLegacyLiveTier=true` so mapped seats can MATCH; target cutover must flip this off with tariff removal (**spec-defined**, timing ops).

No new product decisions invented.

## J. Recommendation

**READY FOR SHADOW ACCESS**

Conditions:

- Keep `FF_ENROLLMENT_ACCESS_MODE=off` in production until explicitly approved to set `shadow`.
- Do **not** enable `dual` until shadow logs are stable on a real dataset.
- Do **not** run backfill `--apply` yet.
- Do **not** migrate commerce yet.

---

## Deliverables added/changed

| Path | Purpose |
|------|---------|
| `scripts/phase2-access-fixture.ts` | Local/demo legacy shapes |
| `scripts/phase2-backfill-dry-run-report.ts` | Full mapping dry-run report |
| `src/lib/enrollment-access.ts` | NEW access evaluator |
| `src/lib/enrollment-access.test.ts` | A–J tests |
| `src/lib/access.ts` | Legacy extract + mode switch (default OFF) |
| `src/lib/feature-flags.ts` | `off\|shadow\|dual` |
| `docs/architecture/PHASE2-ACCESS-SHADOW.md` | Design + call graph |
| `docs/architecture/PHASE1-FEATURE-FLAGS.md` | Mode docs |
| `.env.example` | Mode comments |
| `prisma/seed.ts` | Phase 1 table cleanup order |

**Runtime default:** still 100% legacy access.
