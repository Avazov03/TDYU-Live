# PART 10 — APIs & Routes

## 10.1 Page routes

| ROUTE | ROLE | PURPOSE | ACCESS | MAIN | API | DB | CTA | STATES |
|-------|------|---------|--------|------|-----|----|-----|--------|
| `/` | public | marketing | none | page.tsx pricing | none | session, sub, entitlement | register/login/tarif/onboard/app | guest / paid / onboarded |
| `/go` | any | redirect home | auth | go/page | — | sub/ent | — | redirect |
| `/login` | public | login | none | LoginForm | NextAuth | user | go | error/loading/Google |
| `/register` | public | signup | none | RegisterForm | POST register | user | login | validation 409 |
| `/forgot-password` | public | reset request | RL | form | POST forgot | tokens | — | generic ok |
| `/reset-password` | public | set pw | RL | form | POST reset | user hash | login | invalid token |
| `/invite/[token]` | public | teacher accept | valid invite | InviteForm | POST invite | user, teacher | login | 404 expired |
| `/checkout` | logged-in | demo pay | login | CheckoutClient | POST demo | payment, entitlement, sub? | onboard/app | review/method/processing/success/error |
| `/onboard` | student | pick teacher | entitlement, no sub | TeacherPicker | POST enroll | sub | /app | empty teachers |
| `/app` | student | Bugun | requireStudentCabinet | page | — | lessons, assignments, attendance | learn | empty |
| `/my-courses` | student | subs | cabinet | MyCoursesBoard | — | all subs | courses | empty/filter |
| `/schedule` | student | plan | cabinet | ScheduleBoard | — | lessons | learn | empty |
| `/assignments` | student | tasks | cabinet | AssignmentsBoard | POST submit | assignments | submit | empty/late/done |
| `/certificates` | student | list | cabinet | page | — | certs | print | empty |
| `/certificates/[id]` | owner/admin/any teacher | print | auth + role/owner | page | — | cert | print | 404 / redirect |
| `/history` | logged-in student+ | history | requireAppUser | HistoryBoard | — | attendance | learn | empty |
| `/search` | app user | courses | requireAppUser | page | suggest | courses | course | empty/noq |
| `/shorts` | app user | live feed | t2/t3 students | LiveShortsFeed | — | live lessons | | locked/empty |
| `/courses/[id]` | public | course | published | page | — | course | checkout/learn | 404 unpublished |
| `/learn/[id]` | public SSR | watch | getLessonAccess / staff | MeetRoom/video | attendance, chat, signal | lesson | tarif/login | paywall/live/ended |
| `/settings` | logged-in | profile | auth | SettingsForm | PATCH telegram | user | — | — |
| `/privacy` `/terms` | public | legal | none | static | — | — | — | — |
| `/admin` | admin | KPI | layout | charts | — | dashboard | nav | — |
| `/admin/users` | admin | students | layout | AdminUsersManager | entitlements, block, reset | users | | |
| `/admin/teachers` | admin | teachers | layout | AdminTeachersManager | teachers APIs | | |
| `/admin/courses` | admin | courses | layout | AdminCoursesBoard | courses APIs | | |
| `/admin/payments` | admin | payments | layout | AdminPaymentsBoard | — | payments | | |
| `/teacher` | teacher | studio | page | page | courses, quick-live | | live |
| `/teacher/reja` | teacher | plan | page | forms+board | lessons CRUD | | |
| `/teacher/live/[lessonId]` | teacher owner | studio | page | LiveStudio | lobby/start/end | | |
| `/teacher/group` | teacher | roster | page | TeacherGroupBoard | certificates | | |
| `/teacher/assignments` | teacher | grade | page | forms | assignments, grades | | |

No `loading.tsx` / `error.tsx` anywhere under `src/app`.

## 10.2 API inventory

Auth: JWT cookie via NextAuth. Unless noted.

### Auth

| METHOD | PATH | AUTH | ROLE | INPUT | VALIDATION | READ | WRITE | OUT | ERR | SIDE |
|--------|------|------|------|-------|------------|------|-------|-----|-----|------|
| GET/POST | `/api/auth/[...nextauth]` | NextAuth | — | — | — | users | lastLogin | session | — | Google create |
| POST | `/api/auth/register` | public | — | name,email,pw | zod | user email | user student | 201 user | 400 409 500 | log |
| POST | `/api/auth/invite` | public | — | token,name,pw | zod | invite | user teacher, invite used, workspace | ok email | 400 403 409 500 | |
| POST | `/api/auth/forgot-password` | public RL 5/15m | — | email | zod | user | tokens | generic ok (+dev URL) | 400 429 500 | email |
| POST | `/api/auth/reset-password` | public RL 10/15m | — | token,pw | zod | token | hash, usedAt | ok | 400 403 429 | |
| POST | `/api/auth/stop-impersonate` | session impersonatorId | — | — | — | — | — | ticket | 400 | |

### Student / shared writes

| METHOD | PATH | AUTH | ROLE | INPUT | VAL | READ | WRITE | OUT | ERR | SIDE |
|--------|------|------|------|-------|-----|------|-------|-----|-----|------|
| POST | `/api/enroll` | yes | student | teacherId | zod | entitlement, teacher | expire other subs, upsert sub, publish course | ok courseId | 401 400 403 404 500 | workspace |
| POST | `/api/payments/demo` | yes | any | tier, courseId?, provider | zod | course? | payment, entitlement, sub? | next, payment | 401 400 404 500 | 30d |
| POST | `/api/assignments/submit` | yes | any with sub | form assignmentId, text, file≤8MB | manual | assignment, sub | submission upsert, disk | item | 401 403 404 400 | public file |
| GET | `/api/notifications` | optional | — | — | — | notifs 20 | — | items or [] | — | |
| PATCH | `/api/notifications` | yes | — | — | — | — | isRead true | ok | 401 | |
| PATCH | `/api/settings/telegram` | yes | — | chatId | zod digits | — | telegramChatId | ok | 401 400 | |
| GET | `/api/search/suggest` | **no** | public | q | len | lessons, teachers, courses | — | suggestions | — | |
| GET | `/api/lessons/[id]/chat` | **no** | public | — | — | 120 msgs | — | items | — | |
| POST | `/api/lessons/[id]/chat` | yes | staff or t2/t3 access | text 1–500 | manual | lesson, access | chatMessage | 201 item | 401 403 404 400 | priority t3 |
| POST | `/api/live/signal` | yes | staff or access | join/leave/signal/poll/event | zod | lesson **live only** | memory room | snap | 401 403 400 | |
| GET | `/api/media/recording/[id]` | yes | staff or access | Range | path prefix | lesson | — | 200/206 stream | 401 403 404 | |
| GET | `/uploads/lessons/[filename]` | **no** | public | filename | no `..` | disk | — | file CORS * | 404 | |

### Teacher

| METHOD | PATH | AUTH | INPUT | WRITE | NOTES |
|--------|------|------|-------|-------|-------|
| POST | `/api/teacher/lessons` | teacher+profile | courseId, title, summary, cover, scheduledAt | lesson | notify students+teacher |
| PATCH | `/api/teacher/lessons/[id]` | owner | title/summary/cover/scheduledAt | lesson | not lobby/live |
| DELETE | `/api/teacher/lessons/[id]` | owner | — | delete | scheduled only |
| POST | `.../lobby` | owner | — | status lobby | notify t2 |
| POST | `.../start` | owner | — | live + mux | notify t2 |
| POST | `.../end` | owner | recordingUrl? | ended, mux complete, close room | notify all |
| POST | `.../recording` | owner | file ≤120MB | recordingUrl | disk |
| GET/POST | `.../assets` | owner | file ≤20MB MIME list | LessonAsset | disk |
| DELETE | `.../assets/[assetId]` | owner | — | unlink+delete | |
| POST | `/api/teacher/lessons/quick-live` | teacher | — | scheduled or existing live | |
| POST | `/api/teacher/courses` | teacher | plan | course+lessons | notify |
| POST | `/api/teacher/assignments` | teacher | course, title, desc, due | assignment | notify |
| POST | `/api/teacher/grades` | teacher | submissionId, grade 0–100, note | submission | notify grade |
| POST | `/api/teacher/certificates` | teacher | courseId, userId uuid | cert upsert | notify; **no enrollment check** |

All teacher routes: 403 if not teacher, 404 if no profile / not owner.

### Admin

| METHOD | PATH | EXTRA AUTH | WRITE |
|--------|------|------------|-------|
| POST | `/api/admin/entitlements/[userId]` | admin | extend/cancel entitlement only |
| POST | `/api/admin/subscriptions/[id]` | admin | extend/cancel sub only |
| POST | `/api/admin/impersonate` | admin | ticket (ensureTeacherUser) |
| POST | `/api/admin/users/[id]/block` | admin | student isBlocked |
| POST | `/api/admin/users/[id]/reset-password` | **super** | random pw, returns plaintext |
| POST | `/api/admin/teachers` | admin | teacher+invite; notify admin |
| POST | `/api/admin/teachers/[id]/block` | admin | linked user isBlocked |
| POST | `/api/admin/teachers/[id]/reset-password` | **super** | ensureTeacherUser + plaintext |
| DELETE | `/api/admin/teachers/invites/[id]` | admin | unused invite |
| POST | `/api/admin/courses` | admin | course |
| PATCH | `/api/admin/courses/[id]` | admin | course fields |

### Infra

| METHOD | PATH | AUTH | EFFECT |
|--------|------|------|--------|
| POST | `/api/mux/webhook` | **none** | ended + muxVodPlaybackId + notify |
| POST | `/api/telegram/webhook` | optional secret header | handleTelegramUpdate |
| GET | `/api/cron/lesson-reminders` | CRON_SECRET required | reminders |
| GET | `/api/cron/telegram-poll` | CRON_SECRET if set | pollTelegramOnce |

## 10.3 Frontend component map (high-traffic)

```
AppShell → Sidebar, Topbar → SearchBar, NotificationBell, theme
AdminShell → admin nav + AdminCapabilities/Charts/managers
CheckoutClient → payments/demo
TeacherPicker → enroll
LiveStudio → MeetRoom → live/signal; lobby/start/end
Learn page → MeetRoom | media/recording | mux iframe | LiveChat
```

END OF PART 10
