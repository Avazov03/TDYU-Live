# Lexify — Security Model

**Authority:** `docs/product/FINAL-SYSTEM-SPEC.md`

---

## 1. Core principle

**LINK ≠ ACCESS.**

Knowing a lesson URL, recording URL, material filename, or chat endpoint must never grant access without server checks.

---

## 2. Access chain (live)

```
1. Authenticated session (JWT/session)
2. Account eligibility for this action
3. Active Enrollment for course (not refunded/cancelled)
4. Lesson belongs to that course
5. Lesson/LiveSession joinable (WAITING_ROOM or LIVE as appropriate)
6. Live/security gate (session ban, risk, etc.)
7. Issue short-lived signed join token (userId, courseId, lessonId, roomId, exp, jti)
8. Every signal/WS/poll validates token + re-checks enrollment + state
```

Waiting room: allow presence/chat; **deny teaching media** until LIVE.

---

## 3. Separate account concerns (no single ambiguous block)

| Concern | Controls | Effect |
|---------|----------|--------|
| Purchase eligibility | `purchaseAllowed` / account restriction | Blocks **new** purchases; does **not** auto-destroy ownership |
| Enrollment access | Enrollment status | Live/recording/materials |
| Live/session security | session bans, risk engine, moderation remove | Current live only or temporary deny |
| Admin block (legacy `isBlocked`) | Migrate into above; stop using one flag for all | |

---

## 4. Resource authorization matrix

| Resource | Student | Teacher | Admin |
|----------|---------|---------|-------|
| Public catalog course | published only | — | all |
| Checkout/pay | own + purchaseAllowed | deny | deny (or support tools separate) |
| Enrollment data | own | own courses’ roster | all |
| Waiting/live join | enrolled | instructor of course | monitor/moderate per policy |
| Chat | enrolled + joinable states | instructor | monitor |
| Materials | enrollment accessOpen | instructor | manage |
| Recording PUBLISHED | enrollment accessOpen | instructor | manage |
| Recording pre-publish | deny | instructor review | view |
| Certificate | owner | issuer for own course only | view history |
| Other student PII | deny | limited roster fields | full |

Cross-course IDOR: always bind resource → courseId → enrollment/ownership check.

---

## 5. Media / chat hardening

- No public GET chat.
- No anonymous lesson file routes with CORS `*`.
- Recordings not served as static public files; authenticated media routes with path allowlist.
- Temporary signed URLs optional; still enrollment-bound.

---

## 6. Commerce security

- Server authoritative price (Course.listPrice); reject client amount mismatch.
- Idempotency-Key on checkout/confirm; unique provider txn when present.
- Webhooks: signature verify + replay cache + idempotent handlers.
- Demo payments flagged; never counted as real revenue.
- Refund: policy engine server-side; access revoke in same transaction as REFUNDED when possible.

---

## 7. Live infrastructure security

- Shared room state (Redis or equivalent) — not `globalThis` alone.
- peerId must be bound to authenticated user / token; reject spoof.
- Rate-limit join token minting and signal endpoints.
- One active student live session: new join invalidates previous token/session.
- Mux webhook: verify signature; ignore unknown events; idempotent by event id.

---

## 8. Risk-based controls

Signals: unknown device, unusual network, rapid device switches, burst join failures.

Actions: step-up challenge / temporary cooldown / SecurityEvent — not constant CAPTCHA.

Watermark subsystem: live video only; appear on screen-record detection; no punitive auto-kick from detection alone.

---

## 9. Admin / audit

- Destructive actions: confirmation + reason + AuditLog (immutable).
- Secrets never returned to UI (tokens, plaintext passwords beyond one-time reset already constrained).
- Cron endpoints: require `CRON_SECRET`; no open poll if unset.
- Super-admin style privileges: explicit permission scopes preferred over email-only long-term.

---

## 10. CURRENT gaps to close (verified)

| Gap | File/area |
|-----|-----------|
| No isBlocked in getLessonAccess | `src/lib/access.ts` |
| Public chat GET | `src/app/api/lessons/[id]/chat/route.ts` |
| Public lesson uploads | `src/app/uploads/lessons/[filename]/route.ts` |
| Unsigned Mux webhook | `src/app/api/mux/webhook/route.ts` |
| Signal live-only (waiting broken) | `src/app/api/live/signal/route.ts` |
| Process-local rooms | `src/lib/live-rooms.ts` |
| Cert any teacher view | `src/app/certificates/[id]/page.tsx` |
| Cert issue without enrollment | `src/app/api/teacher/certificates/route.ts` |

---

## 11. Non-goals (V1)

- Perfect DRM / 100% capture prevention.
- Constant CAPTCHA.
- Auto-delete of primary data for “healing”.
