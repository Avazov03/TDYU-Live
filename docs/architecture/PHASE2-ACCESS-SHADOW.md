# Phase 2 Access — Shadow Design & Call Graph

**Status:** Implementation present; **default mode OFF**. No commerce/live rewrite. No backfill apply.

## Modes

| Mode | Env | Served result | NEW enrollment path |
|------|-----|---------------|---------------------|
| OFF | `FF_ENROLLMENT_ACCESS_MODE=off` (default) | Legacy Subscription | not run |
| SHADOW | `…=shadow` | **Legacy always** | computed + `MATCH`/`MISMATCH` log |
| DUAL | `…=dual` | Enrollment if seat row exists; else legacy fallback | used for decision |

Compat: `FF_ENROLLMENT_ACCESS=shadow|true|dual` still parsed via `getEnrollmentAccessMode()`.

## Modules

- `src/lib/enrollment-access.ts` — NEW seat evaluator `(userId, courseId)`; no `endsAt` denial; no expire-other-courses
- `src/lib/access.ts` — `getLegacyLessonAccess` + `getLessonAccess` mode switch
- `src/lib/feature-flags.ts` — mode helper

## Access call graph (CURRENT callers)

All lesson-gated paths go through `getLessonAccess` (except cabinet “any active sub” gates):

| Call site | Helper | Phase 2 note |
|-----------|--------|--------------|
| `src/app/learn/[id]/page.tsx` | `getLessonAccess` | Shadow-ready |
| `src/app/api/live/signal/route.ts` | `liveGate` → `getLessonAccess` | Shadow-ready; live security later |
| `src/app/api/media/recording/[id]/route.ts` | `getLessonAccess` | Shadow-ready; public uploads separate |
| `src/app/api/lessons/[id]/chat/route.ts` POST | `getLessonAccess` | GET still public (later) |
| `src/app/api/assignments/submit/route.ts` | `getActiveSubscription` | Still legacy; dual later |
| `src/app/courses/[id]/page.tsx` | `getActiveSubscription` | Display only |
| Cabinet: `/app`, `/schedule`, `/assignments`, `/my-courses`, `/certificates` | `requireStudentCabinet` / `getActiveSubscriptions` | Still Subscription list |
| `/history`, `/search`, `/shorts` | `requireAppUser` | Still any-sub |
| `home-path.ts`, landing, AppShell, SiteChrome, onboard, enroll | Entitlement/Subscription | Unchanged |
| Teacher/admin stats | `isSubscriptionActive` counts | Unchanged |

**Authority goal:** eventually one Enrollment SoT for course seat; cabinet lists must migrate in a later dual step (not this prep).

## Multi-course

NEW evaluator is strictly `(userId, courseId)`. No global expire. Legacy `POST /api/enroll` expire-others **unchanged** (still dangerous) until `FF_DISABLE_ONBOARD_ENROLL`.

## Permanent replay

Documented dependency: recording phase must use `accessOpen`, never reintroduce `endsAt` denial on Enrollment path.

## Account status

`purchaseAllowed` / `accountStatus` / `isBlocked` are **not** inputs to enrollment seat evaluator.

## Security

Enrollment lookups stay server-side. Callers pass session `userId`; do not trust client body `userId`.
