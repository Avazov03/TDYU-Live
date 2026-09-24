# Phase 7 / Live Wave 3 — AttendanceInterval (LIVE participation)

**Status:** Staging via `FF_LIVE_ATTENDANCE_V3=true` (requires Wave 1 `FF_LIVE_WAITING_ROOM_V2`)  
**Keeps:** enrollment access, Checkout V2, waiting room V2, AV policy V2  
**Production untouched** — Wave 3 flag defaults **OFF**.

---

## 1. Attendance model

Uses existing `AttendanceInterval` (not legacy `Attendance` upsert):

| Field | Role |
|-------|------|
| userId | Student |
| lessonId | Lesson |
| liveSessionId | LiveSession (required for Wave 3 opens) |
| joinedAt | Server time on LIVE join |
| leftAt | Server time on leave / disconnect / end |
| source | `"live"` |

Duration = `leftAt - joinedAt` (or `now - joinedAt` while open). Never negative.

Legacy `Attendance` (one row per user+lesson for history) remains separate and unchanged in purpose.

---

## 2. Waiting Room distinction

**Waiting Room ≠ attendance.**

`shouldOpenLiveAttendance` denies `phase=lobby` / session `waiting`.  
`POST /api/live/join` only opens an interval when `phase=live` and session status is `live`.

---

## 3. LIVE join

Authorized student join (Enrollment + LiveSession LIVE) → create interval (`leftAt=null`) or **reuse** existing open interval (refresh race / idempotent).

Teachers/moderators never get student AttendanceIntervals.

---

## 4. Leave

`POST /api/live/signal` `action=leave` → close open interval for that user+session.

---

## 5. Disconnect

Explicit leave on MeetRoom unmount. Hard disconnect: poll-path stale cleanup closes open intervals when peer missing from in-memory room longer than **45s** (`ATTENDANCE_STALE_MS`). Limitation: not instantaneous WebRTC-perfect detection.

---

## 6. Reconnect

Leave/disconnect closes interval. Later LIVE join creates a **new** row. Intervals are never auto-merged.

---

## 7. Late join

Join after session start is valid — `joinedAt` is the server join time.

---

## 8. Live-end cleanup

Teacher end → `endLiveSession` then `closeAllOpenAttendanceForLiveSession`. No open interval remains for that session.

---

## 9. Security

- Server timestamps only  
- Student cannot open for another user (auth session binds userId)  
- GET `/api/live/attendance`: student = own rows; teacher/admin of course = all  
- Closed enrollment / non-joinable session denied by `authorizeLiveJoin` before open  

---

## 10. Multi-student

Independent rows per `userId` + `liveSessionId`. Partial unique index: one **open** interval per user+session.

---

## 11. Course completion independence

Attendance does **not** set course completion, history access, or certificates.

---

## 12–13. Tests / E2E

Unit: `src/lib/live-wave3-attendance.test.ts`  
E2E: `e2e/live/wave3-attendance.spec.ts` (`E2E_LIVE_WAVE3=1`, dedicated lesson `liveLessonIdWave3`)

---

## 14–15. Staging / Production

```
FF_LIVE_ATTENDANCE_V3=true   # staging only
```

Production: leave unset/false. No Wave 3 deploy to prod.

---

## 16. Migration

`20260924180000_attendance_one_open_per_session` — unique partial index only (non-destructive).

---

## 17. Remaining limitations

- Stale disconnect ≈ 45s after peer TTL  
- In-memory presence for stale cleanup (single Node process)  
- No admin correction UI  

## 18. Next Live Wave

Recording review, screen-share policy, or shared-room/TURN — pick one.
