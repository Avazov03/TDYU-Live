# Phase 7 / Live Wave 2 — Camera / Microphone Policy + Teacher Controls

**Status:** Staging via `FF_LIVE_AV_POLICY_V2=true` (requires Wave 1 `FF_LIVE_WAITING_ROOM_V2=true`)  
**Keeps:** `FF_ENROLLMENT_ACCESS_MODE=enrollment`, `FF_COURSE_CHECKOUT_V2=true`  
**Production untouched** — Wave 2 flag defaults **OFF**.

**No migration** — A/V permission is session-scoped in `__tdyuLiveRooms` peer state.

---

## 1. Existing A/V architecture (audit)

| Area | Finding |
|------|---------|
| MeetRoom | Poll signaling; `getUserMedia` on join (was also in lobby) |
| Publishing | Local tracks `enabled` flag; WebRTC `RTCPeerConnection` + replaceTrack |
| Teacher controls | Client `grant` / `revoke` / `hand` via `/api/live/signal` event |
| Student | Raise hand → teacher grant auto-enabled mic (undesired) |
| Auth gap | Room role check only; no AuditLog; student could attempt teacher events (blocked by role, not dedicated API) |
| Waiting | Lobby still called `getUserMedia` |

**Reuse:** poll signaling, `peerId = u_<userId>`, `authorizeLiveJoin`, Enrollment access.  
**Do not rewrite:** WebRTC mesh, TURN, recording.

---

## 2. Student default policy

On join (student):

- `avPermission = none`
- `canSpeak = false`, `allowCam = false`
- `micOn = false`, `camOn = false`
- Local tracks created only in **live** phase, all `enabled = false` until grant + explicit toggle

**Waiting room:** never calls `getUserMedia` / `getDisplayMedia`.

---

## 3. Raise Hand

`POST /api/live/av` `{ action: "raise_hand" }`

- Student only
- `NONE|REVOKED → REQUESTED`, `handRaised = true`
- Does **not** grant publish rights

---

## 4. Teacher grant / revoke

| Action | Effect |
|--------|--------|
| `grant` | `REQUESTED/… → GRANTED`; sets `canSpeak`/`allowCam`; clears hand; **does not** turn devices on |
| `revoke` | `→ REVOKED`; clears speak/cam; forces mic/cam off |

Identity: `targetPeerId` must be stable `u_<userId>` in the same room.

---

## 5. Teacher mute

`action: "mute"` → `teacherMuted = true`, `micOn = false`.  
Permission may remain `GRANTED` — mute ≠ revoke.  
Server clamps any student `state` with `micOn: true` while muted.

**Limitation:** mesh WebRTC cannot cryptographically stop a malicious client from sending RTP after bypassing UI. Enforcement is server state + clamp + client track disable — strongest within current architecture. Documented; not claimed as hardware root-of-trust.

---

## 6. Camera-off

`action: "camera_off"` → `teacherCamOff = true`, `camOn = false`.  
Same clamp model as mute. Never auto-turns camera ON.

---

## 7. Server authorization

`POST /api/live/av`:

1. `FF_LIVE_AV_POLICY_V2` + Wave 1 flag  
2. Authenticated session  
3. `authorizeLiveJoin` (Enrollment → lesson → LiveSession)  
4. Active non-ended LiveSession  
5. Teacher actions require `moderator` (course teacher / admin)  
6. Student may only raise/lower own hand  

When flag on, `/api/live/signal` **rejects** `grant|revoke|mute|camera_off` (`USE_AV_API`).

---

## 8. Browser permissions

Server grant ≠ browser permission. If `getUserMedia` fails: clear error, stay in room, raise-hand still works. No retry spam.

---

## 9. Multiple students

Independent peer rows keyed by `u_<userId>`. Grant A does not change B/C.

---

## 10. Audit logging

Teacher actions write `AuditLog`:

- `live.av.grant` / `revoke` / `mute` / `camera_off`
- metadata: lessonId, courseId, liveSessionId, targetPeerId

No heartbeat noise.

---

## 11. Security tests (unit + E2E intent)

| Attack | Expected |
|--------|----------|
| Student grant / grant-other | DENY |
| Forge state mic/cam without grant | Clamped OFF |
| After revoke publish | Clamped OFF |
| Outside Enrollment | DENY (authorizeLiveJoin) |
| Other course teacher | DENY (not moderator) |
| Ended LiveSession | DENY |
| Shared URL alone | No A/V permission |

---

## 12. Unit / Live tests

`src/lib/live-wave2-av.test.ts` — defaults, raise/grant/revoke, mute/cam-off, multi-student, non-moderator deny, clamp.

```
npm run test:live
```

---

## 13. E2E

`e2e/live/wave2-av-policy.spec.ts` — gated by `E2E_LIVE_WAVE2=1`.  
Asserts OFF defaults, raise hand, grant status, revoke, unauthorized raise deny.  
Fake media flags optional for device enable paths.

---

## 14. Remaining limitations

- In-memory rooms (single Node process) — no Redis yet  
- Teacher mute is policy+signaling, not SFU media gate  
- No screen share / whiteboard / attendance / recording Wave  
- Lobby→live remount re-requests media only in live phase  

---

## 15. Staging deployment

```
FF_ENROLLMENT_ACCESS_MODE=enrollment
FF_COURSE_CHECKOUT_V2=true
FF_LIVE_WAITING_ROOM_V2=true
FF_LIVE_AV_POLICY_V2=true
```

Port 3101 staging only. Production: leave `FF_LIVE_AV_POLICY_V2` unset/false.

---

## 15b. Identity Collision Fix

**Defect (Wave 2 browser E2E):** `livePeerIdForUser` truncated UUID hex to 24 characters.

Staging fixture UUIDs share a long common prefix (`a6666666-6666-6666-6666-…`). Differentiating digits sit in the last 8 hex chars, so teacher `…6602` and student `…6611` both mapped to:

`u_a66666666666666666666666`

Teacher joined first with `GRANTED` moderator A/V. Student reused the same in-memory peer slot (`joinLivePeer` preserves flags) and incorrectly showed **「Ruxsat berildi」** before any grant.

**Fix:** peer id is now the full normalized UUID hex:

`u_<32 hex chars>` (deterministic, no truncation)

Verified: colliding-prefix fixture users produce distinct peer ids; student joins with `avPermission=none` and does not inherit teacher grant/mute/cam-off/hand state.

No DB migration — peer id remains derived from user identity.

---

## 16. Production safety

Flag default **false**. No schema migration. Prod process/env not modified by this Wave.

---

## 17. Next Live Wave (recommended)

Wave 3 candidates (pick one): AttendanceInterval, screen-share policy, or shared-room/TURN — **not** started here.
