# PART 9 — Admin UX

## 9.1 Gate

`src/app/admin/layout.tsx`: login required; `isAdminRole` else `/`. Shell: `AdminShell` (not AppShell).

## 9.2 Nav (AdminShell)

Bugun `/admin` · O'quvchilar `/admin/users` · O'qituvchilar `/admin/teachers` · Kurslar `/admin/courses` · To'lovlar `/admin/payments`. Top: Bosh sahifa, theme, settings, signOut.

**No** dedicated subscriptions page, invites page (invites live on teachers), or settings/CMS page. SiteSetting unused.

## 9.3 Bugun `/admin`

`getAdminDashboard()` + AdminCapabilities + KPI cards + charts + Diqqat (live, invites, expiring subs).

### Metrics formulas

| METRIC | FORMULA | SOURCE | FILTER | TIME | MISREAD RISK |
|--------|---------|--------|--------|------|----------------|
| O'quvchilar | `user.count role=student` | users | all students | all time | includes blocked, never-paid |
| O'qituvchilar | `teacher.count` | teachers | profile rows | all | includes invite-pending (userId null) |
| Invite kutilmoqda | `teacher.count userId=null` | teachers | | | |
| Teachers blocked KPI | `user.count role=teacher isBlocked` | users | | | not shown as main card; in query |
| Kurslar | `course.count` | all | includes unpublished | | |
| Faol obuna | subscriptions `endsAt > now` length | | | now | **course subs**, not entitlements; user with 2 courses counts 2 |
| Hozir jonli | `lesson.count status=live` | | | now | |
| Shu oy to'lov | sum amount | payments | createdAt ≥ monthStart local JS, status in demo_paid,paid | calendar month of **server local TZ** (`new Date(y, m, 1)`) | **demo money**; TZ may not be Tashkent |
| Tiers donut | count active subs by tier | same activeSubs | | | |
| Registrations chart | students createdAt last 30 Tashkent days | | role student | 30d | |
| Revenue chart | sum demo_paid+paid last 30 Tashkent days | | | 30d | demo |
| Lesson status week | lessons scheduledAt in [now-7d, now+7d] by status | | | | |
| Top courses | take 40 newest courses, count active subs, top 5 | | | | not “all time popular” |
| Expiring | subs endsAt in (now, now+7d] take 6 | | | 7d | |
| Course health | see admin-courses healthOf | | | | stale groups idle+stale |
| Course attendancePct | present unique (lesson,user) / (activeStudents × lessonsInSet) | ended or any attendance | active subs only | | page-open attendance |
| Course paymentSum | sum demo_paid+paid on that course | Payment.courseId | | all time | platform pays have courseId null → **not** on course |

`monthStart` uses **server timezone**, while day series uses Asia/Tashkent. Potential split.

## 9.4 Students `/admin/users`

AdminUsersManager: filter, block, entitlement ±30 / cancel, subscription ±30 / cancel, super-admin password reveal.

Tariff column: `activeEntitlement ?? first activeSub` (`admin/users/page.tsx`).
`hasSubscription` true if either.
`courseCount`: active count or all subs length.
`completedCourses`: certificate count (not progress).
`lessonCount`: attendance count.

## 9.5 Teachers `/admin/teachers`

Invite create, copy URL, delete unused invite, block linked user, impersonate, super-admin password.

Impersonate: POST `/api/admin/impersonate` → ticket → client signIn credentials with ticket (see ImpersonateTeacherButton).

## 9.6 Courses `/admin/courses`

AdminCoursesBoard from `getAdminCourseBoard`: groups by teacher, health, prices edit, publish toggle. POST create / PATCH update. **No delete.**

## 9.7 Payments `/admin/payments`

Last 300 payments; 14-day chart demo_paid+paid; filters in client board; emails only if super-admin.

## 9.8 Missing admin UX vs TZ

TZ: “kurs/tarif, statistika, to‘lovlar”. No in-app faculty/subject manager. No real settlement. No impersonate student.

END OF PART 9
