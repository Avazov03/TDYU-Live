# PART 3 — Roles & Permissions

## 3.1 Role inventory

| Role | Storage | How obtained |
|------|---------|--------------|
| `student` | `UserRole` enum, default | `/api/auth/register`, Google first login |
| `teacher` | enum | Invite accept `/api/auth/invite`; admin `ensureTeacherUser` |
| `admin` | enum | `npm run admin:create` / seed; **no self-serve admin signup** |
| super-admin | **not a role** | email in `SUPER_ADMIN_EMAIL` or default `avazov@tdyu.live` AND `role===admin` |
| impersonated teacher | JWT `impersonatorId` | admin ticket → credentials `ticket` |

There is **no** `superadmin` in Prisma.

[FACT]
File: src/lib/roles.ts
Function: isAdminRole / isTeacherRole / isStudentRole
Relevant code: strict equality to `"admin"` / `"teacher"` / `"student"`
Meaning: any other string is treated as non-admin non-teacher; Sidebar then uses **student nav**.

## 3.2 Student

### A) Can see
Landing, auth pages, legal. After **active Subscription**: `/app`, `/my-courses`, `/schedule`, `/assignments`, `/certificates`, `/history`, `/search`, `/settings`, `/learn/[id]` (paywall if access fails), `/courses/[id]`. `/shorts` only if `canWatchLive` on **getAnyActiveSubscription** tier (t2/t3). `/onboard` if entitlement and no sub.

### B) Can create
Account, demo payment, enroll (teacher pick), assignment submission, chat messages (t2/t3 + access.ok), telegram chat id, password reset request.

### C) Can update
Submission upsert; telegram chat id; mark notifications read. **Cannot** update name/email/password in settings (UI says later). Theme via localStorage only.

### D) Can delete
Nothing via API (no account delete). Can clear own search history in localStorage.

### E) Cannot
Teacher/admin APIs (403). Live if t1. Chat if t1. Shorts nav hidden if sidebar `tariffTier==="t1"`. Start/end lessons. Issue certificates. Admin impersonate.

### F) Open routes (page)
See PART 10. Cabinet pages use `requireStudentCabinet` or `requireAppUser`.

### G) Open APIs
Auth public + session APIs listed in PART 10. Student-specific writes: enroll, payments/demo, assignments/submit, chat POST (if tier), live/signal (if live + access), notifications, settings/telegram, media/recording GET.

### H) UI navigation
Sidebar student: Bugun, Kurslarim, Dars reja; Yana: Shorts (hidden t1), Ko'rilganlar, Topshiriqlar, Sertifikatlar, Bosh sahifa. Avatar → `/settings`.

### I) Server permission
`requireStudentCabinet`, `requireAppUser`, `getLessonAccess`, enroll `isStudentRole`, assignment `getActiveSubscription`.

### J) Client permission
Sidebar hides Shorts for t1; CheckoutButton just links; TeacherPicker posts enroll; Learn paywall is **server-rendered**.

## 3.3 Teacher

### A) See
`/teacher`, `/teacher/reja`, `/teacher/group`, `/teacher/assignments`, `/teacher/live/[lessonId]`, `/settings`, `/` . If they open student cabinet URLs: `requireStudentCabinet` **redirects to `/teacher`**.

### B) Create
Courses (plan), lessons, assignments, certificates, lesson assets, local recordings, quick-live lesson.

### C) Update
Lesson patch (not lobby/live), lobby/start/end, grades, recording URL.

### D) Delete
Scheduled lessons only; own lesson assets.

### E) Cannot
Admin user/teacher/payment managers. Enroll as student (`isStudentRole` required). Delete live/ended lessons. Edit lesson while lobby/live.

### F) Routes
Teacher pages check `session.user.role !== "teacher"` → `/`. **Teacher layout does not auth.** Direct URL `/teacher` without login → login redirect on that page.

### G) APIs
All `/api/teacher/*` check `role === "teacher"` + `getTeacherForUser`. Missing Teacher profile → 404 `"Profil yo'q"`.

### H) Nav
Studio, Reja, O'quvchilar, Topshiriqlar, Bosh sahifa.

### I/J) Server vs client
Actions are fetch() from client components (`LiveStudio`, forms) to teacher APIs that re-check role. UI does not expose admin nav.

## 3.4 Admin

### A) See
`/admin/*` via `admin/layout.tsx`. Also `/settings`, `/`, certificate print (role admin). If they hit `/app`: `requireStudentCabinet` redirects `/admin`.

### B–D)
Create teachers+invites, courses; patch courses; block students/teachers; extend/cancel entitlements and subscriptions; impersonate teacher (ticket); super-admin reset passwords; delete unused invites.

**Cannot delete courses/users/payments via API found.** No admin lesson start.

### E) Cannot
Student enroll. Teacher lesson APIs unless impersonating.

### F) Routes
`/admin`, `/admin/users`, `/admin/teachers`, `/admin/courses`, `/admin/payments`. Layout: unauthenticated → login; non-admin → `/`.

### G) APIs
`/api/admin/*` + `isAdminRole`. Password reset endpoints additionally `viewerCanSeeCredentials`.

### H) Nav
AdminShell: Bugun, O'quvchilar, O'qituvchilar, Kurslar, To'lovlar. AppShell admin fallback (if used): Studio `/admin` + home. Admin LMS pages use **AdminShell**, not AppShell.

### I) Server: layout + each API.
### J) Client: AdminUsersManager / TeachersManager hide secret columns unless `canSeeSecrets`.

## 3.5 Super-admin (email)

Sees login+password reveal/copy; can POST reset-password for users and teachers. Other admins get 403 `"Faqat super admin"` on those APIs.

Alias: credentials login `avazov` maps to `avazov@tdyu.live` (`resolveLoginId`).

## 3.6 Impersonation

[FACT]
File: src/lib/auth.ts authorize
Relevant code: ticket `kind==="as"` requires admin not blocked and **target.role === "teacher"** only
Meaning: admin can impersonate teachers, **not students**.

Ticket TTL 120s (`createImpersonateTicket`). Restore via `/api/auth/stop-impersonate` + `kind:"back"`.

## 3.7 Blocked users

Checked at credentials/Google/invite/forgot-password. **Not** checked in `getLessonAccess` or most APIs after JWT exists.

Student block: `/api/admin/users/[id]/block` (students only).
Teacher block: `/api/admin/teachers/[id]/block` sets linked User.isBlocked.

## 3.8 UI hidden vs backend open

| Case | Evidence |
|------|----------|
| Shorts hidden for t1 in sidebar, but `/shorts` still reachable | Sidebar omits link; page `requireAppUser` then EmptyGuide if !canWatchLive. **Not a 403.** |
| Learn page reachable without cabinet subscription check | `learn/[id]` does **not** call `requireStudentCabinet`; uses `getLessonAccess` paywall. Direct URL works. |
| Search suggest **public** | GET `/api/search/suggest` no auth; SearchBar on AppShell (logged-in UX) but API is open |
| Chat GET public | `GET /api/lessons/[id]/chat` no auth |
| Lesson files public | `GET /uploads/lessons/[filename]` no auth |
| Assignment files under `/public/uploads/assignments` | Next static; submit stores public URL |
| Teacher APIs 403 if student forges fetch | role checked server-side |
| Admin pages | layout redirect; APIs 403 |
| `requireRole()` unused | pages duplicate checks |
| Payments demo: **any logged-in role** | no `isStudentRole` — teacher/admin can POST demo pay |
| Certificate print: **any teacher** can open **any** cert id | `role !== "admin" && role !== "teacher"` then owner check; teachers are allowed without course ownership |

## 3.9 Backend blocked, UI still shows

| Case | Evidence |
|------|----------|
| Lobby MeetRoom shown, signal API requires `status==="live"` | learn page `canJoinLive` includes lobby; `liveGate` rejects non-live. Teacher LiveStudio same MeetRoom in lobby. |
| Dashboard “Hozir jonli” + “Kirish” for t1 | `/app` links `/learn/[id]` even if `canWatchLive` false; badge “Yozuvdan keyin”. Learn then paywalls `live_locked`. |
| Upcoming scheduled lessons link to `/learn/[id]` | access reason `not_started` paywall |
| Course page lesson rows for subscribers always “Ochish” | no per-status/tier disable |
| Payme/Click buttons | always demo API |
| T3 “birinchi navbatda tekshirish” | teacher list is **sorted** by tier; no lock that t3 must be graded first |
| Certificates empty copy: “Kursni tugatib (darslar + topshiriqlar)” | issue API has **no** eligibility |
| Settings name/email/password fields | displayed read-only; no PATCH user profile API found |
| Language shown | `User.language` not writable in UI |

## 3.10 Role check locations (server)

- Pages: `access.ts`, `home-path.ts`, `admin/layout.tsx`, each teacher page, checkout, onboard, certificates/[id], settings
- APIs: inline `auth()` + `role !== "teacher"` or `isAdminRole` or `isStudentRole`
- Lesson: `getLessonAccess` (subscription, not role except staff bypass on learn page)

Staff bypass on **learn page only** (`staffJoin`): admin or course’s teacher. **media/recording** and **live/signal** have similar staff checks. **chat POST** too.

`getLessonAccess` itself has **no admin/teacher bypass**. Staff is layered in those callers.

END OF PART 3
