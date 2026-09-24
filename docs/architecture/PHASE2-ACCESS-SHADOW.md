# Phase 2 Access — Shadow Design & Call Graph

**Status:** Implementation present; **default mode OFF**. No commerce/live rewrite. No backfill apply.

## Modes

| Mode | Env | Served result | NEW enrollment path |
|------|-----|---------------|---------------------|
| OFF | `FF_ENROLLMENT_ACCESS_MODE=off` (default) | Legacy Subscription | not run |
| SHADOW | `…=shadow` | **Legacy always** | computed + `MATCH`/`MISMATCH` log |
| DUAL | `…=dual` | Enrollment if seat row exists; else legacy fallback | used for decision |
| ENROLLMENT | `…=enrollment` | **Enrollment sole SoT** (no Subscription allow) | used for decision; no `endsAt` denial |

Compat: `FF_ENROLLMENT_ACCESS=shadow|true|dual|enrollment` still parsed via `getEnrollmentAccessMode()`.

## Modules

- `src/lib/enrollment-access.ts` — NEW seat evaluator `(userId, courseId)`; no `endsAt` denial; no expire-other-courses
- `src/lib/access.ts` — `getLegacyLessonAccess` + `getLessonAccess` mode switch; cabinet accepts open Enrollment in dual/enrollment
- `src/lib/feature-flags.ts` — mode helper
- `src/middleware.ts` — blocks direct `/uploads/recordings/*` (use gated API)

## Access call graph (CURRENT callers)

All lesson-gated paths go through `getLessonAccess` (except cabinet “any active sub/enrollment” gates):

| Call site | Helper | Phase 2.6 note |
|-----------|--------|----------------|
| `src/app/learn/[id]/page.tsx` | `getLessonAccess` | Uses mode |
| `src/app/api/live/signal/route.ts` | `liveGate` → `getLessonAccess` | Uses mode |
| `src/app/api/media/recording/[id]/route.ts` | `getLessonAccess` | Uses mode; middleware blocks static bypass |
| `src/app/api/lessons/[id]/chat/route.ts` GET+POST | `getLessonAccess` | GET gated in 2.6 |
| `src/app/uploads/lessons/[filename]/route.ts` | `getLessonAccess` | Gated in 2.6 |
| `src/app/api/assignments/submit/route.ts` | `hasCourseContentAccess` | Migrated off Subscription-only |
| `src/app/courses/[id]/page.tsx` | `getActiveSubscription` + `getOpenEnrollment` | Display |
| Cabinet: `/app`, `/schedule`, `/assignments`, `/my-courses`, `/certificates` | `requireStudentCabinet` | Accepts open Enrollment when dual/enrollment |
| `/history`, `/search`, `/shorts` | `requireAppUser` | Same |
| Assignment **file** URLs under `/uploads/assignments/` | public static | **Remaining** — teacher download path; not lesson SoT |
| `home-path.ts`, landing, onboard, enroll | Entitlement/Subscription | Unchanged (legacy commerce) |

**Authority goal (enrollment mode):** Enrollment `status` + `accessOpen` is lesson/content SoT. Subscription/Entitlement remain for migration compatibility only.

## Multi-course

NEW evaluator is strictly `(userId, courseId)`. No global expire. Legacy `POST /api/enroll` expire-others **unchanged** (still dangerous) until `FF_DISABLE_ONBOARD_ENROLL`.

## Permanent replay

Documented dependency: recording phase must use `accessOpen`, never reintroduce `endsAt` denial on Enrollment path.

## Account status

`purchaseAllowed` / `accountStatus` / `isBlocked` are **not** inputs to enrollment seat evaluator.

## Security

Enrollment lookups stay server-side. Callers pass session `userId`; do not trust client body `userId`.
