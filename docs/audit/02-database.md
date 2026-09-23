# PART 2 — Database & Entities

Source of truth: `prisma/schema.prisma` (PostgreSQL, Prisma 7).

## 2.1 Enums

| Enum | Values | Notes |
|------|--------|--------|
| `UserRole` | `student`, `teacher`, `admin` | default student |
| `Language` | `uz`, `ru`, `en` | default `uz`; UI is hardcoded Uzbek |
| `Theme` | `dark`, `light` | default `dark`; actual theme also in localStorage `ot-theme` |
| `TariffTier` | `t1`, `t2`, `t3` | no names in DB |
| `LessonStatus` | `scheduled`, `lobby`, `live`, `ended` | **no** cancelled / recording / archived |
| `PaymentStatus` | `demo_paid`, `pending`, `paid`, `failed` | **no** refund / cancelled / expired |
| `PaymentProvider` | `demo`, `payme`, `click` | |
| `NotificationType` | `lesson_starting`, `lesson_live`, `assignment`, `grade`, `certificate`, `system` | |

## 2.2 Models (fields)

### User (`users`)

| Field | Type | Notes |
|-------|------|--------|
| id | uuid pk | |
| fullName | string | |
| email | string unique | stored lowercased on register/invite |
| passwordHash | string? | Google-only users can be null |
| googleId | string? | |
| role | UserRole | default student |
| avatarUrl | string? | |
| language | Language | default uz |
| theme | Theme | default dark; settings form does not persist theme to DB (client localStorage) |
| isBlocked | boolean | default false |
| lastLoginAt | DateTime? | set on credentials + Google sign-in |
| telegramChatId | string? | |
| createdAt | DateTime | |

Relations: teacherProfile?, entitlement?, subscriptions[], payments[], attendance[], submissions[], certificates[], notifications[], chatMessages[], passwordResetTokens[].

**Who creates:** register API (student), Google sync (student), invite accept (teacher), admin create-admin script, seed.
**Who updates:** self (telegram chat id, not name/email/password — settings copy says “keyingi yangilanishda”), admin block/reset, auth lastLogin.
**Who sees:** self via session; admin student list; teacher sees enrolled students (name/email) on group board.

### PasswordResetToken

id, userId (cascade), tokenHash unique, expiresAt, usedAt?, createdAt. Index userId.

### Faculty (`faculties`)

id, nameUz, nameRu, nameEn, order default 0.
Relations: subjects[], courses[], teachers[].
Created in seed; **no admin API to CRUD faculties** found.

### Subject (`subjects`)

id, facultyId cascade, nameUz/Ru/En.
Created in seed; **no admin API to CRUD subjects** found. Admin teacher create requires existing facultyId/subjectId.

### Teacher (`teachers`)

| Field | Type | Notes |
|-------|------|--------|
| id | uuid | |
| userId | string? unique | null until invite accepted / ensureTeacherUser |
| facultyId, subjectId | required, cascade delete | |
| fullName, contactEmail | string | |
| createdAt | | |

Relations: user?, faculty, subject, courses[], invites[].

**Important:** Teacher is a **profile row**, not the same as User. A User with role teacher may have no Teacher profile (UI: “Admin sizni fan bilan bog'lagach…”).

### TeacherInvite

id, teacherId cascade, token unique, expiresAt (default 14 days via `inviteExpiresAt`), usedAt?, createdAt.

### Course (`courses`)

| Field | Type | Notes |
|-------|------|--------|
| id | uuid | |
| teacherId, facultyId, subjectId | required, **onDelete Cascade** | deleting teacher/faculty/subject deletes courses |
| titleUz, descriptionUz | | **no titleRu/titleEn** despite faculty/subject i18n |
| priceT1, priceT2, priceT3 | Int | so'm integers |
| isPublished | Boolean default **true** | only publish flag; **no draft/paused/ended/archived enum** |
| createdAt | | |

Relations: lessons[], subscriptions[], payments[], assignments[], certificates[].

**Lifecycle statuses draft/active/paused/ended/archived: NOT IN SCHEMA.** Only `isPublished`.

### Subscription (`subscriptions`)

id, userId cascade, courseId cascade, tier, startsAt, endsAt, createdAt.
**`@@unique([userId, courseId])`** — one row per user per course (upsert, not history of periods).

### Entitlement (`entitlements`)

Comment in schema: `Platforma tarifi: to‘lovdan keyin o‘qituvchi tanlanadi.`
id, **userId unique**, tier, startsAt, endsAt, createdAt.
One platform tariff per user. Not tied to a course.

### Lesson (`lessons`)

id, courseId (index, cascade), titleUz, summaryUz?, coverUrl?, scheduledAt, status default scheduled, muxLiveStreamId?, muxLivePlaybackId?, muxVodPlaybackId?, streamKey?, recordingUrl?, createdAt.

**No** duration, no cancelled, no actualStart/actualEnd timestamps.

### LessonAsset

id, lessonId, fileName, fileUrl, mime, createdAt.

### Attendance (`attendance`)

id, userId, lessonId, **joinedAt default now()**.
**Only field is joinedAt.** No leftAt, no duration, no status enum.
`@@unique([userId, lessonId])`.

### Assignment

id, courseId cascade, lessonId? SetNull, titleUz, descriptionUz, dueAt, createdAt.

### Submission

id, assignmentId, userId, text?, fileName?, fileUrl?, grade Int?, teacherNote?, createdAt, gradedAt?.
`@@unique([assignmentId, userId])`. Grade 0–100 enforced in API zod, not DB check.

### Certificate

id, userId, courseId, issuedAt default now, issuedBy? (stores user id of issuer).
`@@unique([userId, courseId])`. **No eligibility fields.**

### Payment

id, userId cascade, courseId? SetNull, tier, amount Int, status default **demo_paid**, provider default **demo**, createdAt.
**No unique constraint** — duplicate payments allowed.
**No** external transaction id, no webhook payload, no refundedAt.

### Notification

id, userId, type, titleUz, messageUz, relatedId?, isRead default false, createdAt. Index `[userId, isRead]`.

### ChatMessage

id, lessonId, userId, text, priority Boolean default false, createdAt. Index `[lessonId, createdAt]`.

### SiteSetting

id, key unique, value text.
Seed deletes this table. **No application reads found in the scanned API/pages** (ANIQLANMADI / unused in src app flow).

## 2.3 Entity meanings (product)

### User
Account. Role discriminates student/teacher/admin. Not every teacher User has a Teacher row.

### Student
Not a table. `User.role === "student"`. Access via Entitlement then Subscription.

### Teacher
`Teacher` row + optional linked `User`. Admin creates Teacher first; invite creates/links User.

### Admin
`User.role === "admin"`. Super-admin is email allowlist.

### Course
Teacher workspace unit. Auto-created by `ensureTeacherWorkspace` as `{subject.nameUz}` if teacher has zero courses. Teachers can create more via `POST /api/teacher/courses`. Admin can create/edit via admin APIs.

### Lesson
Scheduled event on a course. Status machine: scheduled → lobby → live → ended.

### Live session
Not a table. A Lesson with `status` lobby or live + in-memory room in `globalThis.__tdyuLiveRooms`.

### Recording
Not a table. `Lesson.recordingUrl` (local file) and/or `muxVodPlaybackId`.

### Assignment / Submission / Certificate
As models above. Certificate is **manual teacher action**, not auto from progress.

### Tariff
Not a table. Enum `TariffTier` + constants in `src/lib/tariffs.ts`. Course has three price ints. Platform has `PLATFORM_PRICES`.

### Entitlement
Paid platform seat (30 days, one per user). Does **not** open lessons by itself.

### Subscription
Course access row (tier + window). **This is what `getLessonAccess` reads.**

### Payment
Ledger row. Created only by demo checkout in app code (plus seed).

### Attendance
“Opened learn page while lesson was lobby/live/ended and access.ok”. Not live-join telemetry.

### Progress
**No Progress model.** UI percentages are computed (see PART 6).

### Notification / Invite / Faculty / Subject
As models.

### Course plan
Not a table. Teacher form `CreateCoursePlanForm` → one Course + N Lessons.

### Schedule
Not a table. Query of Lessons for subscribed courseIds.

### Chat
`ChatMessage` persisted (used on ended learn page) **and** in-memory live chat in `live-rooms.ts` (MeetRoom). Two chat systems.

### Shorts
Not a table. `/shorts` lists `Lesson status=live`.

## 2.4 ER diagram (text)

```
User
 ├── Teacher? (1:1 via Teacher.userId)
 ├── Entitlement? (1:1)
 ├── Subscription[] (N:1 Course; unique userId+courseId)
 ├── Payment[]
 ├── Attendance[] ── Lesson
 ├── Submission[] ── Assignment
 ├── Certificate[] ── Course
 ├── Notification[]
 ├── ChatMessage[] ── Lesson
 └── PasswordResetToken[]

Faculty
 ├── Subject[]
 ├── Teacher[]
 └── Course[]

Subject
 ├── Teacher[]
 └── Course[]

Teacher
 ├── User?
 ├── Faculty, Subject
 ├── TeacherInvite[]
 └── Course[]
      ├── Lesson[]
      │    ├── Attendance[]
      │    ├── Assignment[]? (optional lessonId)
      │    ├── ChatMessage[]
      │    └── LessonAsset[]
      ├── Subscription[]
      ├── Payment[]
      ├── Assignment[]
      └── Certificate[]
```

## 2.5 Who writes what (lifecycle)

| Entity | Create | Update | Delete |
|--------|--------|--------|--------|
| User student | register, Google | login lastLogin; settings telegram; admin block/reset | none in app |
| User teacher | invite / ensureTeacherUser | invite, reset password, block | none |
| User admin | `scripts/create-admin.ts` | UNKNOWN in UI | none |
| Faculty/Subject | seed only (app) | none found | cascade if deleted at DB |
| Teacher | admin POST /api/admin/teachers | invite sets userId/fullName; block user | none in app |
| Invite | admin teacher create | usedAt on accept; DELETE unused | DELETE unused |
| Course | ensureTeacherWorkspace, teacher courses API, admin courses API, seed | admin PATCH (incl isPublished, prices); enroll sets isPublished true | none in app (cascade from teacher) |
| Entitlement | demo payment upsert | demo payment overwrite; admin extend/cancel | none |
| Subscription | demo payment if courseId; enroll upsert | enroll expires others; admin extend/cancel | none (unique upsert) |
| Payment | demo payment, seed | none | none |
| Lesson | teacher lessons / courses plan / quick-live | lobby/start/end/patch/recording/mux webhook | DELETE if scheduled |
| Attendance | learn page upsert | empty update | none |
| Assignment | teacher API | none | none |
| Submission | student submit upsert | teacher grade | none |
| Certificate | teacher upsert | re-issue updates issuedAt | none |

## 2.6 Consistency risks (facts, not opinions)

1. **Entitlement vs Subscription can diverge** — different APIs update them independently (payment without courseId; admin extend/cancel; enroll copies entitlement into one course but later re-pay does not sync existing subs).
2. **Subscription unique(userId,courseId)** means renew/upgrade **overwrites** the same row; no history of previous periods.
3. **Payment has no unique/idempotency key** — double-click checkout creates two payments and still one entitlement upsert.
4. **Course cascade from Teacher/Faculty/Subject** — deleting a faculty would wipe teachers, courses, lessons, subscriptions.
5. **Teacher.userId SetNull** if User deleted — Teacher row remains; courses remain.
6. **Certificate.issuedBy** is a loose string, not a FK.
7. **ChatMessage GET is unauthenticated** while writes are gated — data exposure of names+text.
8. **Seed student** gets Subscription t1 on course c1 **without Entitlement** (`prisma/seed.ts`). Production enroll path requires entitlement first.
9. **SiteSetting** unused vs present.
10. **isPublished default true** — unpublished is opt-out, not draft workflow.
11. **Attendance unique** — reopen learn page does not update joinedAt (`update: {}`).
12. **Assignment.dueAt** is not enforced on submit API.

END OF PART 2
