# Phase 5 / Wave 5 — Checkout V2 staging activation + browser E2E

**Status:** Staging validated with `FF_COURSE_CHECKOUT_V2=true`  
**Production untouched.** Leave staging flags in the validated target state after PASS.

---

## 1. Previous state

After Wave 4:

- `FF_ENROLLMENT_ACCESS_MODE=enrollment`
- `FF_COURSE_CHECKOUT_V2=false`
- Access / catalog / shell / Tarif UI migration PASS
- Checkout V2 contract tests 45/45 (flag OFF in process)

## 2. Staging flags (target after Wave 5)

| Flag | Value |
|------|-------|
| `FF_ENROLLMENT_ACCESS_MODE` | `enrollment` |
| `FF_COURSE_CHECKOUT_V2` | `true` |

Production: no `FF_*` commerce flags enabled.

## 3. Test course

Disposable staging fixture (reused IDs):

| Field | Value |
|-------|-------|
| Course id | `b2500001-0000-4000-8000-000000000025` |
| Title | Phase 5 Wave 5 Checkout E2E Course |
| `listPrice` | 250000 UZS |
| Lifecycle | `active`, published |
| Capacity | unlimited (`null`) |
| Lesson | `b2500001-0000-4000-8000-000000000026` — Phase 5 Wave 5 E2E lesson |
| Buyer | `fixture.active1@lexify.local` |
| Course A (owned) | Fixture Course A — must remain open |

Prep closes any open Enrollment on Course B for the buyer so the purchase can re-run; Course A is never closed.

## 4. Browser flow

Playwright: `e2e/smoke/checkout-v2.spec.ts` (`npm run test:e2e:checkout-v2`) with `E2E_CHECKOUT_V2_ENABLED=1`.

Course detail → Checkout V2 CTA → `/checkout/v2` → demo pay → success → My Courses → course → lesson.

## 5–7. Purchase / Payment / Enrollment

Asserted from the live `/api/checkout/v2` response and DB verify after run:

- Purchase: correct user/course, `amountPaid == listPrice`, `currency=UZS`, `status=completed`, idempotency key
- Payment: linked, demo, `demo_paid`, `paidAt`, amount/currency match
- Enrollment: active, `accessOpen=true`, linked to purchase
- No Subscription created for Course B by V2
- Legacy Entitlement may pre-exist for the fixture user; V2 does not create a new one for the purchase

Example verified row set (staging, post Wave 5 purchase):

- purchase `aac46725-f32b-421b-85a8-bed2875a338f`
- payment `fb25bd47-423d-43c1-a909-a20d36cb651e`
- enrollment `8e7eec5f-6518-4aa7-adb6-cb2a8a989d57`
- Course A enrollment `7a0499ee-d997-4e83-8481-86306db81433` remained open

## 8. Idempotency

- Same Idempotency-Key → `idempotentReplay=true`, same ids
- New key while enrolled → `409 ALREADY_ENROLLED`

## 9. Multi-course

Course A remains in My Courses and accessible after buying B.

## 10. Capacity / course states

Covered by existing `npm run test:checkout-v2` (45). No destructive capacity fixtures.

## 11. Security

Wave 1 access E2E PASS using dedicated deny Course C (`c2500001-…`) — never owned by `fixture.active1`. Course A remains accessible after buying B.

## 12. Student UI

Checkout V2 CTA is course-priced purchase (no T1/T2/T3). Wave 4 Tarif hide remains with enrollment mode.

## 13. Regression

Smoke, access, catalog, shell, wave4 E2E suites run against staging with Checkout V2 ON.

## 14. Production safety

Only `tdyu-live-staging` restarted. Prod PM2 / `.env` / HTTP unchanged.

## 15. Remaining legacy

- V1 `/api/enroll`, Entitlement, Subscription, TariffTier still in schema
- Admin/teacher tariff surfaces
- Checkout V2 still OFF on production

## 16. Next

Explicit go for Live / Recording / Chat waves, or production Checkout V2 cutover plan — do not auto-start.
