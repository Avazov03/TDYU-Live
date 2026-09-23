# PART 5 — Payment

## 5.1 What exists vs what does not

**Exists**
- UI checkout wizard: review → method → processing (2.2s delay) → receipt
- `POST /api/payments/demo`
- Prisma `Payment` rows
- Admin payments board + revenue KPIs counting `demo_paid` **and** `paid`

**Does not exist in repo**
- Payme Merchant/Subscribe API
- Click API
- Payment webhooks except Mux (unrelated)
- Refund API
- Status transitions pending→paid
- Idempotency keys
- Receipt email
- Real card charging

[FACT]
File: src/components/course/CheckoutClient.tsx
Function: `confirmPay`
Relevant code: always `fetch("/api/payments/demo", { body: { tier, courseId?, provider: method === "card" ? "demo" : method } })`
Meaning: Payme and Click are **UI labels**. Provider column can be `payme`/`click` while status is still `demo_paid`.

[FACT]
File: CheckoutClient.tsx
Relevant code: `"Hozircha demo rejim — haqiqiy pul yechilmaydi"` and aside `"Demo to‘lov: hisobingizga obuna yoziladi, bankdan pul yechilmaydi."`
Meaning: checkout **does** disclose demo. Method titles still say “Payme” / “Click” as if real.

## 5.2 Flow: USER → UI → API → DB → ACCESS → UI

### A. Landing tariff (no course)

USER: `#tariflar` → Tanlash
FRONTEND: `/checkout?tier=t1|t2|t3` (default t2 if invalid)
GATE: login required (`checkout/page.tsx`)
API: `POST /api/payments/demo` `{ tier, provider }`
DB: Payment insert; Entitlement upsert 30 days; **no Subscription**
ACCESS: cannot watch lessons; `resolveHomePath` / onboard
UI: chek; CTA “O‘qituvchi tanlash” → `/onboard`
If they already had an active sub: checkout still says onboard, but onboard redirects `/app`.

### B. Course page tariff

USER: `/courses/[id]` Tanlash
FRONTEND: `/checkout?tier=&courseId=`
API: same, amount from `course.priceT*`
DB: Payment with courseId; Entitlement upsert; **Subscription upsert for that course**
ACCESS: that course immediately
UI: CTA “Kabinetga o‘tish” (`next==="app"`)

### C. Demo karta vs Payme vs Click

All three hit the same API. `provider` stored as `demo` | `payme` | `click`. `status` always `demo_paid`.

### D. Real Payme / Click / webhook / refund / pending / cancelled / expired

**IMPLEMENTED EMAS** (no routes, no status writers except create as demo_paid).

Enum allows `pending`, `paid`, `failed` but **no code path sets them** in `src/` (only seed/demo create). Admin UI can **filter** those statuses (`AdminPaymentsBoard`) on rows that would only exist if inserted manually.

### E. Failed checkout

API 401 → redirect login with callback.
API 4xx/5xx → error string, step back to method.
No rollback UI for partial DB writes (server try/catch returns 500).

## 5.3 Who can pay

API checks `session.user.id` only. Teachers and admins can create demo entitlements for themselves. Students typically.

No CSRF token beyond cookie SameSite (NextAuth). Same-origin fetch from CheckoutClient.

## 5.4 Duplicate payment

No unique constraint. Two successful POSTs → two Payment rows, entitlement overwritten twice (same result if same tier). Amount summed **twice** in admin “revenue”.

## 5.5 Admin analytics vs money

[FACT]
File: src/lib/admin-stats.ts
Function: `getAdminDashboard`
Relevant code: `status: { in: ["demo_paid", "paid"] }` for `monthPayments` and `revenueByDay`
Meaning: **demo_paid counts as revenue**. There is no live `paid` writer, so “Shu oy to‘lov” is demo volume.

Same filter in `src/lib/admin-courses.ts` `course.payments` and `src/app/admin/payments/page.tsx` 14-day chart.

Admin payments page lists **all** statuses (take 300), chart sums demo_paid+paid only.

## 5.6 Privacy/terms

`privacy/page.tsx`: “To‘lov: keyinchalik ulanadigan gateway orqali; demo rejimda pul yechilmaydi.”
`terms/page.tsx`: “Demo to‘lov rejimida haqiqiy pul yechilmaydi.”
`TDYU_Live_TZ.md`: “To‘lov: hozir **demo** (Payme/Click keyin).”

END OF PART 5
