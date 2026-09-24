# CHECKOUT V2 CONTRACT

**Status:** READY FOR IMPLEMENTATION EXCEPT DECISION REQUIRED ITEMS  
**Authority:** Target commerce SoT for Course → Purchase → Payment → Enrollment  
**Date:** 2026-09-24 (decision update)  
**Depends on:** PHASE 2.2 COMMERCE PREPARATION REPORT, `PHASE1-FEATURE-FLAGS.md`, `FINAL-SYSTEM-SPEC.md`

**This document does not change code, schema, flags, or production.**

---

## 1. Purpose

Course-level **direct purchase**. Student buys one Course; access is an Enrollment seat scoped to `(userId, courseId)`.

```
COURSE (eligible)
  → POST /api/checkout/v2
  → Payment (linked)
  → Purchase (completed, amount snapshot)
  → Enrollment (active, accessOpen=true)
  → My Courses / Lesson Access (Enrollment SoT when access mode dual+)
```

**Out of scope for V2 path (never):**

- Tariff / tier selection as commerce SoT
- TeacherPicker / `/onboard` handoff
- `POST /api/enroll` legacy flow
- Expire-other-subscriptions behavior
- Creating `Entitlement` or `Subscription`
- Real Payme/Click provider integration (demo provider only until later)
- Refund execution APIs (compatibility rules only — §15)

---

## 2. Endpoint

### Shape

```
POST /api/checkout/v2
```

**Flag gate:** When `FF_COURSE_CHECKOUT_V2=false`, the endpoint **MUST** return a feature-disabled error response (see §16 / §20). It must **not** server-side redirect to V1 checkout. V1 remains an independent path.

### Headers

| Header | Required | Notes |
|--------|----------|--------|
| `Content-Type` | yes | `application/json` |
| `Idempotency-Key` | **yes** | See §8. Client-generated opaque string (UUID v4 recommended). Max length **64**. |
| Cookie / session | yes | Auth session (same as V1) |

### Idempotency key transport — **LOCKED**

**Choice: HTTP header `Idempotency-Key` only.**

**Reason:** Aligns with Stripe/Payme-style payment APIs; keeps body as pure business payload (`courseId`); avoids clients accidentally omitting key when cloning JSON bodies; matches PRE-PHASE2 mapping (“Idempotency-Key”).

Body **must not** carry a competing idempotency field. If body includes `idempotencyKey`, reject `422 INVALID_BODY` (no dual sources of truth).

### Request body

```json
{
  "courseId": "<uuid>",
  "provider": "demo"
}
```

| Field | Type | Required | Rules |
|-------|------|----------|--------|
| `courseId` | string (uuid) | yes | Server validates existence + eligibility |
| `provider` | `"demo"` \| `"payme"` \| `"click"` | no | Default `"demo"`. Until real providers ship, non-demo may return `501 PROVIDER_NOT_IMPLEMENTED` |

**Forbidden in body / query (always rejected):**

- `amount`, `price`, `listPrice`, `currency`
- `userId`, `tier`, `teacherId`
- `purchaseId`, `enrollmentId`

V2 checkout **does not require** `tier` in query or body.

### Success response — `200 OK`

```json
{
  "ok": true,
  "purchase": {
    "id": "<uuid>",
    "courseId": "<uuid>",
    "amountPaid": 150000,
    "currency": "UZS",
    "status": "completed",
    "completedAt": "<ISO-8601>"
  },
  "payment": {
    "id": "<uuid>",
    "status": "demo_paid",
    "isDemo": true,
    "amount": 150000,
    "currency": "UZS",
    "paidAt": "<ISO-8601>",
    "provider": "demo"
  },
  "enrollment": {
    "id": "<uuid>",
    "courseId": "<uuid>",
    "status": "active",
    "accessOpen": true
  },
  "idempotentReplay": false
}
```

`idempotentReplay: true` when the same `Idempotency-Key` returns a previously committed success (no new rows).

`payment.currency` is part of the **target** API contract. Persisting it on `Payment` requires schema change (§6) — not applied in this doc phase.

### Error response shape

```json
{
  "ok": false,
  "error": {
    "code": "COURSE_NOT_PURCHASABLE",
    "message": "Human-readable uz/ru later; English machine docs OK in V1"
  }
}
```

---

## 3. Authentication

| Condition | Result |
|-----------|--------|
| No session / no `user.id` | **401** `UNAUTHENTICATED` |
| Authenticated, role ≠ student (and not elevated purchase-as-self tools) | **403** `FORBIDDEN_ROLE` |
| Student + `User.isBlocked === true` | **403** `ACCOUNT_BLOCKED` |
| Student + `User.purchaseAllowed === false` | **403** `PURCHASE_NOT_ALLOWED` |
| Student + `accountStatus` ∈ `{restricted, suspended}` affecting purchases | **403** `ACCOUNT_RESTRICTED` |

`userId` is **always** taken from session. Never from body.

---

## 4. Course Eligibility

Server checks **before** any write. All must pass.

### Course existence

- Missing course → **404** `COURSE_NOT_FOUND`

### Lifecycle / sales

**Authoritative when `Course.lifecycleStatus` is non-null:**

| Status | Checkout |
|--------|----------|
| `draft` | **DENY** `422 COURSE_NOT_PURCHASABLE` |
| `submitted` | **DENY** |
| `in_review` | **DENY** |
| `changes_requested` | **DENY** |
| `rejected` | **DENY** |
| `approved` (not published) | **DENY** |
| `published` | **ALLOW** (if other checks pass) |
| `upcoming` | **ALLOW** (if other checks pass) |
| `active` | **ALLOW** (mid-course join; past lessons via recording/materials) |
| `completed` | **ALLOW** (new students may purchase; past content via recording/materials) |
| `archived` | **DENY** |
| `cancelled` | **DENY** |
| `unpublished` | **DENY** |

**Product decision (2026-09-24):** `completed` and `active` courses are purchaseable by new students. Past lessons open via recordings/materials; future lessons continue live. `cancelled` remains closed to new purchase.

**Legacy fallback when `lifecycleStatus` is null:**

- `isPublished === true` → treat as purchasable base
- `isPublished === false` → **DENY**

### Price

- `listPrice` must be non-null integer `>= 0`  
  - null → **422** `PRICE_UNAVAILABLE`  
  - Until Admin sets `listPrice`, V2 cannot sell that course. **No** silent fallback to `priceT1/T2/T3` in V2.

### Capacity

- `capacity === null` → unlimited → OK  
- `capacity` is int → open-seat count must be `< capacity` (see §13)  
- full → **409** `CAPACITY_FULL`

### User purchase flags

- Covered in §3 (`purchaseAllowed`, block, accountStatus)

### Cancelled / not sellable

- Explicitly deny `cancelled`, `unpublished`, draft/review/rejected as above

---

## 5. Price

| Rule | Detail |
|------|--------|
| Source of truth | `Course.listPrice` only |
| Client amount | **Never trusted**; do not accept in body |
| Snapshot | Persist `Purchase.amountPaid = listPrice` at commit time |
| After price change | Existing `Purchase.amountPaid` **unchanged**; new checkouts use new `listPrice` |
| Currency on Purchase | `Purchase.currency` default `"UZS"` (already in schema) |

---

## 6. Currency

### Target semantics — **LOCKED**

- Platform currency: **UZS**
- Purchase stores `currency` (exists today)
- Payment contract requires **explicit** `currency` on Payment (API + DB)

### Schema

`Payment` currently has **no** `currency` column.

**`SCHEMA CHANGE REQUIRED`:** add `Payment.currency` (e.g. `String @default("UZS") @map("currency")`).

**Do not apply that migration in this documentation phase.**  
Until the column exists, V2 implementation that persists Payment rows is blocked for production enablement (or must wait for the migration phase). Interim “echo Purchase.currency in JSON only” is **not** the target contract.

---

## 7. Transaction Boundary

All durable commerce writes for one checkout attempt run in **one DB transaction**.

```
BEGIN
  1. Lock / validate course eligibility + capacity (§4, §13)
  2. Resolve server price = Course.listPrice
  3. Resolve Idempotency-Key (§8)
     - if prior SUCCESS for this key → return stored result (COMMIT no-op / read-only)
     - if prior key with different courseId → CONFLICT (rollback)
  4. Existing active/open enrollment policy (§10)
  5. Create or reuse Purchase (status → completed)
  6. Create or reuse Payment (link purchaseId; isDemo; currency; paidAt; status)
  7. Create or reuse Enrollment (active, accessOpen=true, purchaseId)
  8. Mark statuses consistently
COMMIT
```

On any failure after writes started → **ROLLBACK**.  
No orphan Payment without Purchase/Enrollment; no Enrollment without completed Purchase for V2 path.

**V2 must not** write Entitlement or Subscription inside this transaction.

---

## 8. Idempotency

### Rules

| Case | Behavior |
|------|----------|
| Same `Idempotency-Key` + same `userId` + same `courseId` after success | Return original success payload; `idempotentReplay: true`; **no** new Purchase/Payment/Enrollment |
| Same key + same user + **different** `courseId` | **409** `IDEMPOTENCY_KEY_REUSE` |
| Same key + **different** user | **409** `IDEMPOTENCY_KEY_REUSE` (do not leak other user’s ids) |
| Retry after transient failure (no commit) | Safe to retry with same key; create once |
| Duplicate provider webhook / double submit | Safe via unique constraints + key lookup |

### Persistence strategy (use existing uniques)

| Store | Field | Use |
|-------|--------|-----|
| `Payment.idempotencyKey` | `@unique` | Primary key for payment attempt identity |
| `Purchase.idempotencyKey` | `@unique` | Same client key string (1:1 attempt) — **LOCKED** |
| `Payment.externalTxnId` | `@unique` | Reserved for real provider txn; demo may set `demo:{paymentId}` after insert or leave null |

Enrollment has no idempotency column; open-seat uniqueness via §10 + partial unique index (schema later).

Missing header → **422** `IDEMPOTENCY_KEY_REQUIRED`.

---

## 9. Multi-course

Student may hold **concurrent** active enrollments for Course A, B, and C.

Checkout V2 **MUST NOT**:

- call expire-other-subscriptions logic from `POST /api/enroll`
- set `endsAt = now()` on other courses
- cancel other enrollments

Each checkout is scoped to one `courseId` only.

---

## 10. Existing Enrollment

### Active / open seat — **LOCKED**

`409 ALREADY_ENROLLED` applies **only** when an Enrollment exists for `(session.userId, courseId)` that is **active/open**:

- `accessOpen === true` **and**
- `status ∈ {active, completed}`  
  (completed + open = permanent-replay seat still holds access)

Then:

- **Do not** create Payment / Purchase / Enrollment  
- Return **409** `ALREADY_ENROLLED`  
  Optional body may include existing `enrollment.id` / `courseId` only

### Refund → re-buy — **LOCKED**

If prior Enrollment is **refunded / closed / cancelled** (e.g. `accessOpen === false` and/or `status ∈ {refunded, cancelled}`):

- Student **may** purchase again  
- Create a **new** Purchase + Payment + **new** active Enrollment  
- Old closed rows must **not** block checkout  
- Do **not** return `409 ALREADY_ENROLLED` for those rows

### Same Idempotency-Key exception

If this request’s `Idempotency-Key` already committed a successful V2 checkout for this user+course, return **200** replay (§8), even though an open enrollment exists.

### Uniqueness — **LOCKED (business invariant)**

**One active/open enrollment per `(userId, courseId)`.**

Historical refunded/closed/cancelled enrollments must not prevent re-purchase.

**`SCHEMA CHANGE REQUIRED` (migration written later, not now):** PostgreSQL **partial unique index**, e.g. conceptually:

```sql
CREATE UNIQUE INDEX enrollments_one_open_per_user_course
  ON enrollments (user_id, course_id)
  WHERE access_open = true
    AND status IN ('active', 'completed');
```

Exact SQL/Prisma migration is deferred. Until then, checkout transaction must still enforce the invariant under lock (§13).

---

## 11. Payment

### Relation target

```
Payment.purchaseId → Purchase.id
```

V1 demo today creates Payment **without** Purchase; V2 always links.

### Field purposes (V2)

| Field | Purpose in V2 |
|-------|----------------|
| `purchaseId` | FK to order; required after commit |
| `isDemo` | `true` for demo provider; exclude from real revenue |
| `idempotencyKey` | Client `Idempotency-Key`; unique |
| `externalTxnId` | Provider txn id when real; unique when set |
| `paidAt` | Set when status becomes paid / demo_paid |
| `status` | `demo_paid` for demo success; later `paid` / `failed` / refund states |
| `amount` | Copy of charged amount (= `listPrice` at pay time) |
| `currency` | Explicit; target **UZS** — **SCHEMA CHANGE REQUIRED** (§6) |
| `userId` | Session user |
| `courseId` | Denormalized course id; set when known |
| `provider` | `demo` / future payme / click |
| **`tier`** | **LEGACY only.** Not used by V2 business logic. |

### Legacy `Payment.tier` — **LOCKED for V2 logic**

- Authoritative price: `Course.listPrice`
- V2 **does not** branch on `tier`
- V2 **does not** require `tier` in query/body
- Column retained for legacy V1 compatibility until a later cleanup
- **Do not change `Payment.tier` schema now**

**How V2 inserts satisfy NOT NULL `tier` until migration:** implementation detail deferred with migration timing.

**`DECISION REQUIRED — MIGRATION PHASE`:** when to make `Payment.tier` optional/nullable (or drop) vs continue writing a non-authoritative sentinel for DB compatibility. Not decided here.

Demo V1 (`/api/payments/demo`) remains as-is while flag OFF.

---

## 12. Enrollment

On successful V2 purchase:

| Field | Value |
|-------|--------|
| `userId` | session |
| `courseId` | request |
| `purchaseId` | created Purchase |
| `status` | `active` |
| `accessOpen` | `true` |
| `activatedAt` | now |

**Access SoT (target):** Enrollment `status` + `accessOpen`.  
**Not SoT for V2 access:** `Subscription.endsAt`.

Permanent replay: enrolled students may later be `status=completed` with `accessOpen=true`. Checkout itself always creates `active` + `accessOpen=true`.

V2 does not create Subscription rows.

---

## 13. Capacity — **LOCKED**

### Seat definition (counts toward capacity)

```
openSeatCount = count(Enrollment where
  courseId = X
  AND accessOpen = true
  AND status IN ('active', 'completed')
)
```

**Do not count** toward capacity:

- `accessOpen = false`
- `status ∈ {refunded, cancelled}`
- other closed seats

### Rules

- `capacity === null` → **unlimited** → purchase allowed (other checks OK)
- `openSeatCount >= capacity` → **409** `CAPACITY_FULL` → purchase denied
- else → purchase allowed

`completed` + `accessOpen=true` **does** consume capacity (permanent-replay seat still occupies a seat).

### Concurrent race — transaction-safe strategy (required)

Inside the checkout transaction:

1. Lock course row (`SELECT … FOR UPDATE` on `courses` where id=…) **or** equivalent serializable isolation  
2. Re-count `openSeatCount`  
3. Insert new open enrollment only if still under cap  
4. Rely on partial unique index (when migrated) as a final safety net  
5. Commit  

Do not check capacity only outside the transaction.

---

## 14. Existing Subscription / Entitlement / Enroll

V2 checkout **must not**:

| Action | Forbidden |
|--------|-----------|
| Create/update `Subscription` | yes |
| Create/update `Entitlement` | yes |
| Redirect to TeacherPicker / `/onboard` | yes |
| Call `POST /api/enroll` | yes |
| Expire other subscriptions | yes |
| Server-side redirect to V1 checkout | yes |

Success UX: client navigates to **My Courses** / course hub — product wiring later; API returns ids only.

---

## 15. Refund Compatibility — **LOCKED (future behavior)**

Refund APIs are **not implemented** in Checkout V2 work.

Target future successful refund:

```
Purchase (completed)
  → Refund (approved/completed)
  → Enrollment.accessOpen = false
  → active/open enrollment closed (typically status = refunded)
  → Purchase.status = refunded | partially_refunded
  → Payment.status = refunded | …
```

After that, student **may re-purchase** (§10). New checkout creates a new open Enrollment.

Checkout V2 must not hard-delete Enrollment on purchase in a way that blocks this flow.

---

## 16. Error Contract

| HTTP | `error.code` | When |
|------|--------------|------|
| 401 | `UNAUTHENTICATED` | No session |
| 403 | `FORBIDDEN_ROLE` | Not student |
| 403 | `PURCHASE_NOT_ALLOWED` | `purchaseAllowed=false` |
| 403 | `ACCOUNT_BLOCKED` / `ACCOUNT_RESTRICTED` | Block / accountStatus |
| 403 | `FEATURE_DISABLED` | `FF_COURSE_CHECKOUT_V2=false` — **LOCKED** |
| 404 | `COURSE_NOT_FOUND` | Unknown courseId |
| 409 | `IDEMPOTENCY_KEY_REUSE` | Key reused with different payload |
| 409 | `CAPACITY_FULL` | No open seats left |
| 409 | `ALREADY_ENROLLED` | Active/open enrollment exists (§10) |
| 422 | `IDEMPOTENCY_KEY_REQUIRED` | Missing header |
| 422 | `INVALID_BODY` | Schema / forbidden fields (incl. `tier`) |
| 422 | `COURSE_NOT_PURCHASABLE` | Draft/review/rejected/unpublished/cancelled/… |
| 422 | `PRICE_UNAVAILABLE` | `listPrice` null |
| 501 | `PROVIDER_NOT_IMPLEMENTED` | Non-demo before integration |
| 500 | `INTERNAL_ERROR` | Unexpected / rolled back |

### Feature flag OFF — **LOCKED**

When `FF_COURSE_CHECKOUT_V2=false`:

```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "ok": false,
  "error": {
    "code": "FEATURE_DISABLED",
    "message": "Course checkout v2 is disabled"
  }
}
```

- **No** HTTP redirect to `/checkout` or V1 payment  
- **No** automatic proxy to `POST /api/payments/demo`  
- V1 continues to work on its own routes

Messages: safe for clients; no stack traces; no secrets.

---

## 17. Auditability

Emit structured log / future AuditLog with:

- `userId`
- `courseId`
- `purchaseId`
- `paymentId`
- `enrollmentId`
- `idempotencyKey`
- `amountPaid`
- `provider`
- `isDemo`
- `result` (`success` \| `replay` \| `error.code`)

**Never log:** passwords, raw card data, provider secrets, full session tokens.

---

## 18. Security

- Price only from `Course.listPrice`
- `userId` only from session
- `courseId` validated server-side
- Authorization server-side (role + purchaseAllowed)
- Duplicate open enroll protected (idempotency + §10 + tx + future partial unique)
- No cross-user purchase
- No cross-course access grant
- Capacity checked under lock
- Feature flag prevents accidental production enablement

---

## 19. Backward Compatibility

| `FF_COURSE_CHECKOUT_V2` | Behavior |
|-------------------------|----------|
| **OFF** (default) | V1 `/checkout` + `POST /api/payments/demo` + Entitlement + optional Subscription + onboard/`/api/enroll` **unchanged**. V2 returns `403 FEATURE_DISABLED` (no V1 redirect). |
| **ON** | Course-detail / catalog CTA may call V2. V1 routes **remain deployed** until a later cutover (`FF_DISABLE_TARIFF_UI`, `FF_DISABLE_ONBOARD_ENROLL`). |

V2 ON ≠ delete V1.

---

## 20. Feature Flag

| Env | Code key | Default |
|-----|----------|---------|
| `FF_COURSE_CHECKOUT_V2` | `courseCheckoutV2` | **false** |

| State | API | UI |
|-------|-----|-----|
| OFF | `403` + `FEATURE_DISABLED` | No V2 CTA |
| ON | V2 accepts eligible purchases | Course-level CTA may point to V2 |

Do **not** enable on production until staging E2E matrix passes and related access gates allow.

**This contract phase does not flip the flag.**

---

## 21. Implementation Preconditions

Before enabling V2 in any environment:

| # | Dependency | Note |
|---|------------|------|
| 1 | `listPrice` authoritative for V2 (no triad fallback) | App rule; Admin sets prices |
| 2 | `Payment.currency` column | **SCHEMA CHANGE REQUIRED** — not done yet |
| 3 | Partial unique open enrollment index | **SCHEMA CHANGE REQUIRED** — migration later |
| 4 | `Payment.tier` left as-is for now | V2 logic ignores tier; nullable cleanup = migration-phase decision |
| 5 | Idempotency uniques wired in code | Schema fields exist |
| 6 | `completed` / `active` sales policy | **LOCKED** — both purchaseable |
| 7 | Transaction + capacity lock design (§7, §13) | Locked in contract |
| 8 | Flag OFF until staging proof | Ops |

---

## 22. Test Matrix

| ID | Scenario | Expected |
|----|----------|----------|
| T01 | Valid published course, listPrice set, capacity OK, student | 200; Purchase completed; Payment linked; Enrollment active+accessOpen |
| T02 | Unauthenticated | 401 `UNAUTHENTICATED` |
| T03 | Nonexistent courseId | 404 `COURSE_NOT_FOUND` |
| T04 | Draft | 422 `COURSE_NOT_PURCHASABLE` |
| T05 | In review / submitted / changes_requested | 422 |
| T06 | Rejected | 422 |
| T07 | Unpublished / isPublished false (legacy null lifecycle) | 422 |
| T08 | `purchaseAllowed=false` | 403 `PURCHASE_NOT_ALLOWED` |
| T09 | `listPrice` null | 422 `PRICE_UNAVAILABLE` |
| T10 | Capacity full (open seats) | 409 `CAPACITY_FULL` |
| T11 | `capacity` null (unlimited) | 200 |
| T12 | Duplicate same Idempotency-Key | 200 replay; same ids; no extra rows |
| T13 | Same key, different courseId | 409 `IDEMPOTENCY_KEY_REUSE` |
| T14 | Retry after forced mid-tx failure | Second attempt succeeds once; no partials |
| T15 | Existing open enrollment | 409 `ALREADY_ENROLLED` (unless idempotent replay) |
| T15b | Prior refunded/closed enrollment | 200 new Purchase+Enrollment allowed |
| T16 | Buy course A then B then C | Three active enrollments; none expired |
| T17 | Admin changes listPrice after purchase | Old `amountPaid` unchanged; new buyer sees new price |
| T18 | Provider/payment failure | 4xx/5xx; no Enrollment; no completed Purchase |
| T19 | Transaction failure after Payment insert | ROLLBACK; no orphan Payment |
| T20 | Wrong user cannot attach another userId | Impossible via API |
| T21 | Student cannot get access to unpaid other course | No Enrollment for other ids |
| T22 | Flag OFF | 403 `FEATURE_DISABLED`; no redirect; V1 still works |
| T23 | Concurrent checkouts at last seat | Exactly one 200; other 409 `CAPACITY_FULL` |
| T24 | `tier` in body/query | 422 `INVALID_BODY` |
| T25 | Non-demo provider before integration | 501 `PROVIDER_NOT_IMPLEMENTED` |
| T26 | Refunded seat does not consume capacity | Re-buy allowed when under cap |
| T27 | Completed lifecycle new purchase | 200 allowed (product decision 2026-09-24) |

---

## SCHEMA CHANGE REQUIRED (summary)

| Item | Status |
|------|--------|
| `Payment.currency` | **DONE** in Phase 2.3A migration `20260924100000_phase23a_payment_currency_open_enrollment_unique` (staging applied; production not) |
| Partial unique index on open enrollments | **DONE** same migration (`enrollments_one_open_per_user_course`) |
| `Payment.tier` nullable/drop | **Not now** — timing is migration-phase decision |
---

## DECISIONS STILL REQUIRED

1. **Legacy `Payment.tier` migration timing (`DECISION REQUIRED — MIGRATION PHASE`)**  
   V2 logic ignores `tier` and does not require it from clients. Column stays for legacy compatibility for now (V2 writes a non-authoritative sentinel to satisfy NOT NULL). Decide in a later migration phase when to make it optional/nullable or remove it. **No schema change in Phase 2.3.**

## PRODUCT DECISIONS LOCKED (2026-09-24)

- `completed` course: **purchaseable** by new students  
- `active` / mid-course: **purchaseable**  
- Past lessons: recording/materials; future: live  
- `cancelled`: **not** purchaseable  
- Admin sets `listPrice`; `Purchase.amountPaid` is historical snapshot  
