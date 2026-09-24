# Phase 5 / Wave 4 — Legacy enroll expire-others + Tarif UI

**Status:** Implemented on staging via `FF_ENROLLMENT_ACCESS_MODE=enrollment`  
**Checkout V2 remains `false`.** Production untouched.

---

## 1. Old expire-other behavior

`POST /api/enroll` previously:

1. Required active Entitlement  
2. Ensured teacher workspace course  
3. **Expired all other active Subscriptions** for the user (`endsAt = now`)  
4. Upserted Subscription for the chosen teacher course  

That encoded “one active course” and revoked multi-course access.

## 2. What changed

- `shouldExpireOtherSubscriptionsOnEnroll()` always returns **false** — expire-others removed  
- Response includes `expiredOtherCourses: false`  
- Endpoint kept for V1 Entitlement + TeacherPicker compatibility  
- Honors `FF_DISABLE_ONBOARD_ENROLL` (403) without deleting the route  
- Does **not** create Enrollment / Checkout V2 rows (still Subscription upsert only)

## 3. Multi-course behavior

- V1 enroll into course B no longer closes Subscription A  
- Target ownership remains Wave 1–2 Enrollment seats (independent)  
- Checkout V2 already multi-course safe (unchanged)

## 4. Tarif UI migration

`shouldHideStudentTariffUi()` =

- `FF_DISABLE_TARIFF_UI=true` **OR**  
- `FF_ENROLLMENT_ACCESS_MODE=enrollment`

Hidden / replaced on:

- Landing pricing grid → course CTA (`landing-course-cta`)  
- Notch “Tariflar” nav + Tarif CTA  
- Course detail T1/T2/T3 blocks → non-tariff message (V2 CTA when flag on)  
- My Courses empty/badge labels  
- Learn paywall CTA copy  
- Site footer Tarif links  

Models (`TariffTier`, prices) remain for admin/teacher/V1.

## 5. Compatibility

Kept: Entitlement, Subscription, TeacherPicker, `/api/enroll`, V1 demo payment, TarifTier schema.

## 6. Security

Wave 1 `getLessonAccess` unchanged. Closing one Enrollment still leaves others. No client-only auth.

## 7. Tests

- `src/lib/wave4-legacy-enroll.test.ts` (in `test:access`)  
- `e2e/wave4/tarif-ui.spec.ts`  
- Existing access / catalog / shell / smoke / checkout-v2

## 8. Remaining legacy

- V1 enroll still writes Subscription (not Enrollment)  
- Checkout V2 flag still OFF on staging  
- Admin/teacher tariff displays  
- Telegram “Tariflar” deep link  

## 9. Next Wave

Enable Checkout V2 on staging for real course purchase CTAs, **or** Live/Recording — pick explicitly; do not auto-start Live.
