# Phase 5 / Wave 3 — AppShell / home / navigation Enrollment-first

**Status:** Implemented — gated by `FF_ENROLLMENT_ACCESS_MODE`  
**Staging:** `enrollment` · Checkout V2 `false`  
**Does not enable production.**

---

## 1. Legacy student-shell dependency

| Surface | Old behavior |
|---------|----------------|
| `resolveHomePath` / `/go` | Active Subscription → `/app` |
| Landing CTA | Subscription → Kabinet |
| `SiteHeader` cabinet link | Subscription → `/app` |
| `AppShell` Sidebar | `tariffTier` from Subscription (t1 locks Shorts) |
| `requireStudentCabinet` | Subscription checked **before** Enrollment |
| `/onboard` | Subscription → `/app`; Entitlement → TeacherPicker |

Enrollment-only (Checkout V2) students could be treated as “no cabinet” if Subscription was missing, or Subscription-only users could enter cabinet while mode=`enrollment`.

## 2. New Enrollment-first behavior

Pure helpers in `src/lib/access.ts`:

- `studentHasCabinetMembership`
- `resolveStudentHomePath`
- `resolveStudentShellTariffTier`

| Mode | Cabinet / `/app` | V1 onboard | Shell TariffTier |
|------|------------------|------------|------------------|
| `enrollment` | Open Enrollment only | Entitlement (no seat) | `null` (no t1 Shorts lock) |
| `dual` | Enrollment ∪ Subscription | Entitlement | Subscription tier if present |
| `off`\|`shadow` | Subscription | Entitlement | Subscription tier |

## 3. Pages / components migrated

- `src/lib/home-path.ts`
- `src/lib/access.ts` — `requireStudentCabinet` / `requireAppUser`
- `src/components/layout/AppShell.tsx`
- `src/components/site/SiteChrome.tsx`
- `src/app/page.tsx` (landing CTA)
- `src/app/onboard/page.tsx` (Enrollment → `/app` before TeacherPicker)

## 4. Remaining intentional legacy

- Entitlement + TeacherPicker + `/api/enroll` for V1
- Admin/teacher Subscription counts
- Public tarif UI / priceT* discovery
- Legacy enroll expire-others (later wave)

## 5. Tests

- `npm run test:shell` (also in `test:access`)
- `npm run test:e2e:shell`

## 6. Next Wave

Recommended: disable legacy enroll expire-others + Tarif UI behind flags — **not** Live/Recording.
