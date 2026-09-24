# Phase 7 / Live Wave 1 — Waiting Room + LiveSession lifecycle + server auth

**Status:** Staging via `FF_LIVE_WAITING_ROOM_V2=true`  
**Keeps:** `FF_ENROLLMENT_ACCESS_MODE=enrollment`, `FF_COURSE_CHECKOUT_V2=true`  
**Production untouched** (Live V2 flag remains off).

---

## 1. Existing Live architecture (audit)

| Layer | Reality before Wave 1 |
|-------|------------------------|
| Lesson SM | `scheduled → lobby → live → ended` via teacher APIs |
| Waiting UI | MeetRoom `phase=lobby` + LiveStudio |
| Signal | HTTP poll `/api/live/signal`; **live-only** gate |
| Rooms | `globalThis.__tdyuLiveRooms` (process memory) |
| LiveSession | Schema existed; **unused at runtime** |
| Auth | `getLessonAccess` on signal; client-chosen `peerId` |

Critical bug: lobby UI mounted MeetRoom but signal rejected non-live → broken waiting.

## 2. Wave 1 target

- LiveSession DB lifecycle: WAITING → LIVE → ENDED  
- Waiting room join under flag  
- Server join auth via Enrollment (`getLessonAccess`)  
- Short-lived join token + user-bound peerId  
- No camera redesign, no attendance intervals, no recording pipeline

## 3. LiveSession lifecycle

| Action | Lesson.status | LiveSession.status |
|--------|---------------|--------------------|
| Open waiting | `lobby` | `waiting` (ensure, no duplicate) |
| Start | `live` | `live` |
| End | `ended` | `ended` |

Partial unique index: one active session per lesson  
(`created|waiting|live|paused`).

## 4. Waiting Room

Teacher: LiveStudio → Kutish xonasini ochish.  
Student: `/learn/[id]` MeetRoom lobby + “Dars tez orada boshlanadi”.  
Presence ≠ attendance (no Attendance upsert for lobby when flag on).

## 5. Join authorization

`POST /api/live/join` → `authorizeLiveJoin`:

1. Auth session  
2. Lesson exists / not cancelled  
3. Joinable status (lobby|waiting_room|live) when V2  
4. Teacher/admin moderator **or** `getLessonAccess`  
5. Active LiveSession required when V2  
6. Issue join token + `peerId = u_<userId>`

Subscription-only denied in enrollment mode (Wave 1 access).

## 6. Security model

- No trust of client peerId / courseId / room secrets  
- Shared URL does not grant access without Enrollment  
- Token HMAC tied to user+lesson+session, 15m TTL  
- `__tdyuLiveRooms` kept for signaling only — not auth SoT  

## 7–8. Teacher / Student flows

Teacher: open waiting → start → end (existing routes + LiveSession dual-write).  
Student: join waiting → see LIVE after start → denied after end.

## 9. Refresh / reconnect

`ensureWaitingLiveSession` / `startLiveSession` reuse active row — no duplicate on refresh.

## 10. Duplicate-session protection

DB partial unique index + transactional find-or-create.

## 11. Remaining technical debt

- In-memory rooms (not multi-instance / `FF_LIVE_SHARED_ROOMS` unused)  
- WebRTC mesh / no TURN  
- Raise-hand / mute / screen share / whiteboard still present in MeetRoom but out of Wave 1 scope  
- AttendanceInterval not wired  
- Recording SM not started  

## 12. Tests

- `src/lib/live-wave1.test.ts` (in `test:access` / `test:live`)  
- `e2e/live/wave1-waiting-room.spec.ts` (`E2E_LIVE_WAVE1=1`)  

## 13–14. Staging / Production

Staging enables `FF_LIVE_WAITING_ROOM_V2=true`.  
Production: no Live V2 flag, no deploy.

## 15. Next Live Wave

Camera/mic policy hardening, shared room store, or AttendanceInterval — pick explicitly; do not auto-start Recording.
