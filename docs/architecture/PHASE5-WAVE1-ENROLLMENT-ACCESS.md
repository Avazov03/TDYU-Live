# Phase 5 / Wave 1 — Enrollment authoritative lesson access

**Status:** Implemented on staging via `FF_ENROLLMENT_ACCESS_MODE=enrollment`  
**Does not enable production.** Rollback: set mode back to `shadow`.

Authority: `docs/product/FINAL-SYSTEM-SPEC.md`, `FOUNDATION-CLOSEOUT.md`

---

## 1. Old access path

```
Subscription (userId + courseId)
  → endsAt active?
  → TariffTier live gate
  → ALLOW / DENY
```

Served when `FF_ENROLLMENT_ACCESS_MODE=off|shadow` (shadow still **serves** legacy while logging NEW).

## 2. New access path

```
Enrollment (userId + courseId)
  → status ∈ {active, completed}
  → accessOpen === true
  → lesson status ≠ scheduled (and optional legacy live tier only in dual/shadow)
  → ALLOW / DENY
```

Served when `FF_ENROLLMENT_ACCESS_MODE=enrollment` — **no** Subscription allow path, **no** `endsAt` denial.

## 3. Access decision

Single entry: `getLessonAccess(userId, courseId, lessonStatus)` in `src/lib/access.ts`.

Enrollment evaluator: `getEnrollmentLessonAccess` / `evaluateEnrollmentLessonAccess` in `src/lib/enrollment-access.ts`.

Aliases (Wave 1):

- `canUserAccessCourse(userId, courseId)` → seat check via `hasCourseContentAccess`
- `canUserAccessLesson(userId, lessonId)` → load lesson then `getLessonAccess`

## 4. Runtime callers migrated

All protected lesson/content paths already call `getLessonAccess` (or `hasCourseContentAccess`):

| Call site | Gate |
|-----------|------|
| `/learn/[id]` | `getLessonAccess` |
| `/api/live/signal` | `getLessonAccess` |
| `/api/media/recording/[id]` | `getLessonAccess` |
| `/api/lessons/[id]/chat` | `getLessonAccess` |
| `/uploads/lessons/[filename]` | `getLessonAccess` |
| `/api/assignments/submit` | `hasCourseContentAccess` |
| Cabinet entry | `requireStudentCabinet` / `requireAppUser` (open Enrollment accepted) |
| My Courses board | Subscription **union** Enrollment seats |

Middleware: blocks raw `/uploads/recordings/*` (force gated API).

## 5. Security boundaries

| Scenario | Expected (enrollment mode) |
|----------|----------------------------|
| Logged out | DENY |
| No Enrollment | DENY |
| Enrollment Course A → Lesson Course B | DENY |
| Valid Enrollment matching course | ALLOW |
| `accessOpen=false` / refunded / closed | DENY |
| Completed + `accessOpen` | ALLOW (permanent replay) |
| Direct `/learn/:id` URL | Same server check as navigation |

## 6. Intentional legacy compatibility

Kept (not deleted): TariffTier, Entitlement, Subscription, TeacherPicker, V1 enroll expire-others.

Enrollment path does **not** depend on them for allow/deny in `enrollment` mode.

Intentional shadow MISMATCH:

- OLD DENY (expired Subscription) vs NEW ALLOW (valid Enrollment) → target permanent replay

## 7. Tests

- `npm run test:access` — evaluator + mode matrix (29)
- `npm run test:checkout-v2` — 45 (unchanged)
- `npm run test:e2e:smoke` — 18 (role + Checkout V2 gated)
- `npm run test:e2e:access` with `E2E_ENROLLMENT_AUTHORITATIVE=1` — browser checks under enrollment mode

## 8. Rollback

```bash
# staging .env
FF_ENROLLMENT_ACCESS_MODE=shadow
FF_COURSE_CHECKOUT_V2=false
# then: pm2 restart tdyu-live-staging  (start-staging.sh sources .env)
```

## 9. Remaining access dependencies (next waves)

- `/app`, `/schedule`, `/assignments`, `/shorts` lists still prefer **Subscription** rows for catalog UI (Enrollment-only seats may be incomplete on those pages — My Courses is correct)
- `/api/enroll` still expires other Subscriptions (legacy commerce)
- Assignment static files under `/uploads/assignments/` still public
- Live architecture / Recording model cutover / chat redesign — not Wave 1
- Production still default `off` — do not flip without explicit approval

## 10. Next Wave

Recommended Wave 2 candidates (pick one):

1. Student catalog / My Courses target UX (Enrollment-first listing everywhere)
2. Disable legacy enroll expire-others + Tarif UI behind flags
3. Live join token / signal hardening (AT-SEC)

**Do not** start Live/Recording redesign automatically from this document.
