# PART 11 — Security / Performance / Accessibility / Mobile / Notifications / Search

## 11.1 Security context (mechanisms present or absent — not an exploit guide)

| Topic | What exists | What does not |
|-------|-------------|----------------|
| Auth | NextAuth JWT, credentials bcrypt 12, optional Google | No middleware; JWT not refreshed against isBlocked/role |
| Session | JWT strategy `src/lib/auth.ts` | No DB session store |
| Cookies | NextAuth default (trustHost true) | Cookie flags not customized in repo |
| CSRF | Same-origin fetch; NextAuth cookies | No explicit CSRF token on POST APIs |
| Password | min 8 on register/invite/reset; bcrypt | Settings cannot change password |
| Reset | hashed token, 1h expiry, generic response, IP RL 5/15m and 10/15m **in-memory** | Multi-instance RL ineffective |
| Secrets | `.env*` gitignored; `.secrets/` gitignored; AUTH_SECRET | impersonate HMAC fallback `"dev-only-change-me"` if AUTH_SECRET missing |
| Super-admin | email allowlist | Default email hardcoded in source |
| IDOR | teacher lessons scoped by teacherId; grades scoped; enroll uses session user | **Certificate GET** any teacher; **certificates API** no “is this my student” check; **chat GET** public; **search suggest** public; **lesson uploads** public |
| Admin checks | layout + each admin API `isAdminRole` | |
| Direct API | no middleware; fetch with session cookie works | |
| Rate limit | forgot/reset only (`src/lib/rate-limit.ts` Map) | login, enroll, payments, chat, signal **unlimited** in code |
| Validation | zod on many POSTs | chat POST uses `String(body.text)` not zod; assignments formData manual |
| XSS | React default escaping; Telegram HTML parse_mode on notify titles | User-generated lesson titles in HTML telegram |
| Upload | size limits 8/20/120MB; assignment filename sanitized; lesson MIME allowlist; recording webm name | assignments MIME not checked; stored in **public/**; lesson GET CORS * |
| Payment | demo only | Mux webhook **unsigned**; demo pay any logged-in role |
| Live | auth on signal; status must be live | rooms in process memory; peerId client-supplied (8–80 chars) not bound to userId |
| Impersonate | HMAC ticket 120s, teacher-only | |
| Cron | lesson-reminders requires secret; telegram-poll **open if secret unset** | secret also accepted as `?secret=` query |
| Exposed data | admin super sees emails/passwords-after-reset | seed demo passwords in README |

Login does not rate-limit brute force in this codebase.

`isBlocked` is not queried in `getLessonAccess` or teacher APIs.

## 11.2 Performance context

| Topic | Evidence |
|-------|----------|
| Server components | Most pages |
| Client | MeetRoom (large), Checkout, Sidebar, boards, LiveStudio, SearchBar |
| Fetch | force-dynamic almost everywhere — **no ISR/revalidate** |
| Caching | Next default; recording Cache-Control private no-store; lesson files public max-age 3600 |
| Polling | MeetRoom polls live/signal; NotificationBell fetch on open only |
| Realtime | not websocket; HTTP poll + in-memory |
| Expensive queries | admin-courses loads **all courses** with lessons+attendance+payments; teacher group same; admin users all students |
| N+1 | `notifyCourseStudents` loops notifyUser (each creates notif + optional telegram/email); reminder loops findFirst per lesson |
| Lists | payments take 300; history 50; search 24; suggest 6+4+3 |
| Video | Mux iframe or `<video>` local; MeetRoom getUserMedia |
| Images | SVG thumbs `thumbs.ts`; mux thumbnail URL |
| Heavy libs | framer-motion, tsparticles on landing, MeetRoom WebRTC |
| Live rooms | per Node process; PM2 cluster would split rooms (**UNKNOWN** if cluster_mode) |

`getShellData` may send reminders on **every** AppShell render for students.

## 11.3 Accessibility (from code, not audit lab)

**Present:** many `aria-label`s (bell, search, checkout steps/radiogroup, meet room, sidebar menu, filter tabs, admin caps); `lang="uz"`; checkout `role="radiogroup"`; FilterChips `role="tablist"`; `prefers-reduced-motion` in `globals.css` (multiple blocks) and Sidebar `animate={!reduced}`; password show/hide labels.

**Absent / weak:** no `src/app/**/error.tsx`; NotificationBell and profile menus are `div.dropdown` **not** `role="dialog"` / no focus trap (UNKNOWN if keyboard-complete); MeetRoom complexity — keyboard coverage ANIQLANMADI without runtime; contrast depends on CSS tokens (DESIGN.md claims tokens; runtime measurement UNKNOWN); some icon-only buttons.

## 11.4 Responsive / mobile (from CSS/components)

- Sidebar: `hidden md:flex` desktop 60↔300px; `md:hidden` full drawer; toggle event only if `max-width: 767px` (`Sidebar.tsx`).
- Admin sidebar: separate CSS (`admin-shell`); mobile behavior ANIQLANMADI beyond globals.
- globals.css media queries include ~520, 640, 700, 767/768, 800, 860, 900, 960.
- Checkout: `lx-checkout-shell` — layout CSS exists; exact column collapse ANIQLANMADI without screenshot.
- Tables: teacher reja / admin users use cards+filters more than HTML tables.
- Video: `playsInline` on learn video.
- E2E project: **Desktop Chrome only** (`playwright.config.ts`).

Visual mobile QA: **UNKNOWN**.

## 11.5 Notifications

| Trigger | Condition | Delivery | UI |
|---------|-----------|----------|-----|
| AppShell load | student; lesson scheduled in 15m; sub active; no lesson_starting last 24h | notifyUser DB+tg+email | bell |
| Cron lesson-reminders | same batch all users | same | bell |
| Lobby | t2+ subs | lesson_starting | bell → `/learn/id` |
| Start live | t2+ | lesson_live | `/learn/id` |
| End / mux ready | all active subs | lesson_live copy “Yozuv tayyor” or “Dars tugadi” | `/learn/id` |
| New lesson | all subs | system | **bell maps system → `/learn/{relatedId}`** (relatedId is lesson id here — OK) |
| New course plan | notifyCourseStudents with relatedId=**course.id** | system | bell → `/learn/{courseId}` **wrong target** |
| Assignment | all subs | assignment | `/assignments` (relatedId unused in href) |
| Grade | that user | grade | itemHref returns **null** for grade (no type handler) → **not a link** |
| Certificate | that user | certificate | `/certificates/{id}` |
| Admin teacher invite | notifyUser to **admin** with invite URL in message | system | relatedId=teacher.id → `/learn/teacherId` wrong |

Telegram bot: link via settings chat id or `start=u_{userId}`; menus today/courses/status.

No subscription-expiry notifier in code. No payment notifier.

## 11.6 Search

| Piece | Behavior |
|-------|----------|
| Data | suggest: published lessons (title/course), teachers by name, published courses title. Page: published courses title/desc/teacher/subject/faculty, q≥2, take 24 |
| Debounce | 250ms (`SearchBar.tsx`) |
| Suggestions | mixed types; video click → `/learn/{id}` (may paywall) |
| History | localStorage `ot-search-history` max 15 |
| Keyboard | activeIndex in SearchBar (arrows — code present) |
| Permissions | **suggest API public**; search **page** requires requireAppUser |
| Ranking | lessons scheduledAt desc, then teachers, then courses; no relevance score |
| Unused | `getActiveSubscriptions` imported in search/page.tsx **unused** (explorer note) |

END OF PART 11
