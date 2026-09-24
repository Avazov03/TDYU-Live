# Phase 5 / Wave 2 — Student catalog / Enrollment-first listing

**Status:** Implemented — gated by `FF_ENROLLMENT_ACCESS_MODE`  
**Staging target:** `enrollment` (Checkout V2 remains `false`)  
**Does not enable production.**

Authority: `FINAL-SYSTEM-SPEC.md`, Wave 1 `PHASE5-WAVE1-ENROLLMENT-ACCESS.md`

---

## 1. Old listing source

```
getActiveSubscriptions(userId)  // Subscription + endsAt
  → courseIds
  → /app, /schedule, /assignments, /shorts filter
My Courses: Subscription rows ∪ Enrollment-only additive
```

Legacy Subscription alone could populate My Courses / cabinet boards.

## 2. New Enrollment-first source

Single helpers in `src/lib/access.ts`:

- `mergeStudentOwnedCourseIds` (pure, tested)
- `getStudentOwnedCourses` / `getStudentOwnedCourseIds`
- `isStudentCourseOwned` (course detail badge)

| Mode | Ownership |
|------|-----------|
| `enrollment` | Open Enrollment only (`active`\|`completed` + `accessOpen`) |
| `dual` | Enrollment ∪ active Subscription (dedupe; Enrollment wins) |
| `off`\|`shadow` | Active Subscription only (legacy listing) |

Enrollment seats never use `Subscription.endsAt`. Multi-course seats stay independent.

## 3. Pages migrated

| Page | Change |
|------|--------|
| `/my-courses` | Enrollment-first via `getStudentOwnedCourses` |
| `/app` | Same ownership SoT for live/upcoming/due/attendance |
| `/schedule` | Lessons scoped to owned courseIds |
| `/assignments` | Assignments scoped to owned courseIds |
| `/shorts` | Live feed membership via owned courseIds; enrollment mode drops Tariff live gate |
| `/courses/[id]` | Owned badge uses `isStudentCourseOwned` |
| `/search` | Unchanged public discovery (removed unused Subscription import) |

## 4. Server-side authorization

Listing queries run on the server with `requireStudentCabinet` / `requireAppUser` and session `user.id`. Course filters use `courseId: { in: ownedIds }` from that user only — client cannot inject another user’s course set.

Lesson/content gates remain Wave 1 `getLessonAccess` / `hasCourseContentAccess`.

## 5. Multi-course behavior

Open Enrollment A + B → both appear on My Courses / schedule / assignments.  
Closing/refunding B (no longer in open-seat query) → A remains; B leaves active listing.

## 6. Legacy retained

TariffTier, Entitlement, Subscription, TeacherPicker, V1 `/api/enroll`, admin/teacher Subscription stats — unchanged.

## 7. Tests

- `npm run test:catalog` / included in `test:access` — Wave 2 pure ownership matrix
- `npm run test:e2e:catalog` — My Courses + non-owned course + lesson nav
- Existing access / checkout-v2 / smoke suites

## 8. Remaining dependencies

- AppShell / SiteChrome / home-path still peek `getAnyActiveSubscription` for chrome (cabinet gate already accepts Enrollment)
- Admin/teacher student counts still Subscription-based
- Legacy enroll expire-others (Wave 3+)
- Live / Recording / chat redesign — later waves

## 9. Next Wave

Recommended: disable legacy enroll expire-others + Tarif UI behind flags, **or** AppShell/home-path Enrollment-first chrome — not Live/Recording.
