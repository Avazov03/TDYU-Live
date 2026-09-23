# PART 12 — Contradictions / Edge cases / Docs vs code / Git / TODO

## 12.1 Contradiction detector

### A) Frontend ↔ backend

| ID | SEVERITY | EVIDENCE |
|----|----------|----------|
| C-A1 | **CRITICAL** | Learn/LiveStudio render MeetRoom for **lobby**; `liveGate` requires `status==="live"`. File: `learn/[id]/page.tsx` vs `api/live/signal/route.ts` |
| C-A2 | HIGH | Enroll UI one teacher; `POST /api/payments/demo` with courseId allows a second active sub. Files: `enroll/route.ts` vs `payments/demo/route.ts` vs `/app` “N ta kurs” |
| C-A3 | HIGH | Checkout `next=onboard` after platform pay even if active sub exists; onboard redirects `/app`. `CheckoutClient` vs `onboard/page.tsx` |
| C-A4 | MEDIUM | Search suggest → `/learn/id` without access; search page only courses |
| C-A5 | MEDIUM | Teacher certificate API does not verify student subscription; UI is on group of **active** students only — API can be called with any userId uuid |

### B) UI label ↔ behavior

| ID | SEV | EVIDENCE |
|----|-----|----------|
| C-B1 | HIGH | `aria-label="Kurs progressi"` + “% yozuv tayyor” — formula is VOD readiness not student completion. `learn/[id]/page.tsx` |
| C-B2 | HIGH | History “Ko'rilganlar” / “Ochgan darslaringiz” = attendance on page open. `history/page.tsx` |
| C-B3 | HIGH | Payme/Click titles vs demo API. `CheckoutClient.tsx` |
| C-B4 | MEDIUM | T3 “birinchi navbatda tekshirish” = sort, not exclusive queue. `teacher/assignments/page.tsx` |
| C-B5 | MEDIUM | Certificates empty: “Kursni tugatib (darslar + topshiriqlar)” vs issue API no check |
| C-B6 | LOW | Settings “keyingi yangilanishda” for name/email/password — fields visible |

### C/D) Pricing page ↔ access / tariff UI ↔ backend

| ID | SEV | EVIDENCE |
|----|-----|----------|
| C-C1 | HIGH | Landing `PLATFORM_PRICES`; course page `course.priceT*`; can differ |
| C-C2 | HIGH | Access uses **Subscription.tier**; landing after pay without enroll uses **Entitlement** only |
| C-C3 | MEDIUM | Shorts lock uses **one** any-active-sub tier; assignments use **all** subs |

### E) Subscription ↔ entitlement

| ID | SEV | EVIDENCE |
|----|-----|----------|
| C-E1 | **CRITICAL** | Re-pay platform updates entitlement, **not** existing subscription. `payments/demo` vs `getLessonAccess` |
| C-E2 | HIGH | Admin extend entitlement ≠ extend subscription (separate APIs) |
| C-E3 | MEDIUM | Seed student has Subscription **without** Entitlement |

### F) Teacher picker ↔ enroll

Picker sends `teacherId`. Enroll binds **first course** `findFirst` / create workspace — not a course picker. Teacher with two courses (seed Karimov has c1 and c2): student gets **whichever findFirst returns** (createdAt/id order **ANIQLANMADI** — Prisma findFirst without orderBy).

### G) Dashboard ↔ database

`/app` counts **all** active subscriptions; landing tarif status shows **one** any-sub.

### H) Analytics ↔ transactions

Revenue includes `demo_paid`. No `paid` writer. Platform payments `courseId` null omitted from per-course paymentSum.

### I) Progress label ↔ calculation

See C-B1.

### J) Attendance label ↔ creation

Teacher “Davomat” / admin attendancePct use rows created by **opening learn**, including lobby, not necessarily live presence (`learn/[id]/page.tsx` upsert).

### K) Role nav ↔ server

t1 Shorts hidden but URL works (EmptyGuide). `/learn` has no cabinet gate. Teacher layout unauthenticated until page. Admin layout gated.

### L) Public marketing ↔ features

TZ §5: `/` “katalog (chip filtr, video-grid)”. Code: marketing landing. `HomeContent.tsx` unused catalog UI.
TZ: Inter + blue accent. DESIGN.md: Syne/Plus Jakarta, teal dark / blue light.
SETUP.md IP `3.79.57.253` vs rules `3.65.92.39`.

## 12.2 Edge cases (SUPPORTED / UNSUPPORTED / UNKNOWN)

1. Payment wrote, DB later failed after payment insert — **SUPPORTED** as 500; orphan Payment possible (no transaction).
2. Payment success, subscription failed — if courseId and upsert throws: 500; entitlement may already be written — **SUPPORTED** partial.
3. Subscription expired — cabinet → entitlement? onboard : `#tariflar`. Learn `expired`. **SUPPORTED**.
4. Old subscription — unique overwrite on enroll/course pay. History of periods **UNSUPPORTED**.
5. New tariff pay — entitlement overwrite; sub not auto-synced — **SUPPORTED** as diverge.
6. Other teacher — UI blocked while sub active; API enroll expires others — **SUPPORTED** API / **UNSUPPORTED** UI.
7. Multiple courses — course checkout **SUPPORTED**; enroll **UNSUPPORTED** (expires others).
8. Lesson not started — paywall not_started **SUPPORTED**.
9. Lesson live — t2/t3 MeetRoom **SUPPORTED**; t1 locked; signal live-only **SUPPORTED**.
10. Lesson ended — VOD if playable **SUPPORTED**.
11. Recording not ready — placeholder **SUPPORTED**.
12. Recording exists — media API or mux **SUPPORTED**.
13. Teacher edits course — **UNSUPPORTED** (no teacher PATCH course). Admin PATCH **SUPPORTED**.
14. Teacher deletes course — **UNSUPPORTED**. Lesson delete scheduled only.
15. Student blocked — login denied; existing JWT **UNKNOWN** until expiry (not rechecked).
16. Teacher blocked — login denied; live APIs still accept JWT **UNKNOWN**/likely **SUPPORTED** until re-login.
17. Admin — full admin shell **SUPPORTED**.
18. Unauthorized API — 401/403 JSON **SUPPORTED** on gated routes; some GET public.
19. Direct URL learn — paywall **SUPPORTED**.
20. UI-hidden shorts URL — EmptyGuide **SUPPORTED** (not 403).
21. Expired sub learn URL — `expired` message **SUPPORTED**.
22. Past ended lesson — watch if sub **SUPPORTED**.
23. Future scheduled — not_started **SUPPORTED**.
24. Two devices live — no device limit **SUPPORTED** (two peers). Memory rooms per process.
25. Duplicate payment — two rows **SUPPORTED**.
26. Duplicate enrollment — upsert same course **SUPPORTED**; unique constraint.
27. Duplicate attendance — unique upsert **SUPPORTED**; joinedAt not updated.

## 12.3 Documentation vs code

### README.md
DOCUMENTATION SAYS: demo logins `demo1234`, emails listed; seed for development.
CODE: seed blocked in production; those users only if seed ran.
DEVIATION: none if local seed.

### SETUP.md
SAYS: production IP `3.79.57.253`.
CODE/rules: `3.65.92.39`.
DEVIATION: IP mismatch.

SAYS: Google OAuth, Resend.
CODE: matches optional.

### TDYU_Live_TZ.md
SAYS: `/` catalog chip+grid; Inter; YouTube DNA; Payme/Click later; attendance when watching; 1-tarif sees recording after Mux webhook.
CODE: marketing `/`; different fonts; demo payme UI; attendance on page open; recording also local webm independent of Mux.
DEVIATION: catalog, fonts, attendance definition.

SAYS: “Topshiriq navbati 3-tarif birinchi”.
CODE: sort only.

### DESIGN.md
SAYS: Taste/Vercel guidelines, Playwright landing smoke.
CODE: `e2e/landing.spec.ts` exists (hero+nav only).

### AGENTS.md / lexify.mdc
SAYS: do not touch open.okina.uz; local 3000; lexify.zonic.fit.
CODE: consistent comments. Docker still named opentsul.

### .env.example
SAYS: Redis unused; Mux optional demo.
CODE: matches. Omits CRON_SECRET, TELEGRAM_WEBHOOK_SECRET (used in code).

### Privacy
SAYS: delete account via contact.
CODE: **no** account deletion API.

## 12.4 Git / evolution (from migrations + remnants, not `git log`)

`git log` dump: **UNKNOWN** in this extraction (command output not captured).

From `prisma/migrations`:

1. `20260324120000_init` — initial
2. `20260909100000_lms_pivot` — dropped YouTube-clone (`videos`, `shorts`, `playlists`, `watch_history`, …); created LMS
3. `20260914120000_lesson_plan_fields` — lesson plan fields
4. `20260916100000_password_reset_tokens`
5. `20260918120000_lesson_lobby` — added `lobby` status

Remnants: `ot-theme`, `ot-search-history`, docker `opentsul-*`, repo `TDYU-Live`, `globalThis.__tdyuLiveRooms`.

## 12.5 TODO / FIXME / DEMO / MOCK

Grep `TODO|FIXME|HACK|NOT IMPLEMENTED|PLACEHOLDER|COMING SOON` in `*.ts,tsx,js,md`: **no matches**.

| FILE | MEANING | PRODUCTION IMPACT |
|------|---------|-------------------|
| `src/app/api/payments/demo/route.ts` | only payment writer | no real money |
| `CheckoutClient.tsx` | Payme/Click as demo | misleading if user ignores fine print |
| `src/lib/mux.ts` | demo_* streams without tokens | live is WebRTC anyway |
| `learn/[id]/page.tsx` player-demo | placeholder when no VOD | |
| `SettingsForm` copy | profile edit later | cannot change email/password in UI |
| Seed `muxVodPlaybackId: demo_vod_intro` | not playable (`hasPlayableRecording` false) | seed “ended” lesson shows waiting |

END OF PART 12
