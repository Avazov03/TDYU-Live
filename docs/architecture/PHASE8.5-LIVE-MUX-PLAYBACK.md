# Phase 8.5 — Mux live playback with Enrollment access

Status: implemented behind `FF_LIVE_MUX_PLAYBACK_V1` (default `false`). Not deployed to production.

## Flag

| Env | Default | Effective when |
|-----|---------|----------------|
| `FF_LIVE_MUX_PLAYBACK_V1` | `false` | `true` **and** `FF_ENROLLMENT_ACCESS_MODE=enrollment` |

Off (or any other access mode): `/learn` renders the WebRTC room exactly as before; `/api/live/mux-playback` returns `404 DISABLED`; `/shorts` keeps the legacy feed.

## Access rule (single model)

With the flag effective, every live surface uses Enrollment:

| Viewer | Mux player | WebRTC room | Attendance | Recordings |
|--------|-----------|-------------|------------|------------|
| Anonymous | 401 | denied | — | denied |
| Signed in, no open enrollment | 403 | denied (`getLessonAccess`) | — | denied |
| Enrolled in another course | 403 | denied | — | denied |
| Enrolled (active/completed, `accessOpen`) | allowed | allowed (opt-in) | on room join | allowed |
| Owning teacher | allowed | moderator | not counted | allowed |
| Admin | allowed | moderator | not counted | allowed |

- Player: `authorizeLiveMuxPlayback` → `getEnrollmentLessonAccess` (no Subscription / tier).
- Room: `authorizeLiveJoin` → `getLessonAccess`, which is Enrollment-only in `enrollment` mode.
- Ended-lesson chat: `canSend` no longer consults `canUseLiveChat(tier)` in `enrollment` mode.

## Live vs replay

- Live player URL is built only by `resolveLivePlaybackSource()` and only while the Mux stream is `active`.
- Replay uses `resolveReplayPlaybackId()`: Recording row → `Lesson.muxVodPlaybackId`. `Lesson.muxLivePlaybackId` is never a replay source (removed from `/learn`, course page, schedule, app home, teacher pages).
- `/api/search/suggest` is unauthenticated and no longer emits `image.mux.com` thumbnails (they exposed playback IDs).
- Fixed (found in staging browser QA): with `FF_RECORDING_REVIEW_V1` on, the teacher's automatic 20 s interim recording upload called `markRecordingReady`, which set `lesson.status=teacher_review` mid-broadcast. Students were dropped to the ended view, and `/end` then returned early without completing the Mux stream, ending the LiveSession or closing attendance. Uploads now only store the file while the lesson is `live`/`lobby`/`waiting_room` (`shouldMarkRecordingReadyOnUpload`); `/end` → `startRecordingAfterLiveEnd` owns the review transition.
- Known legacy caveat: with `FF_RECORDING_REVIEW_V1` off, the legacy browser recording (`/api/media/recording/:id`) is playable to authorized viewers immediately after the lesson ends. Production must enable recording review before relying on "no replay before publish".

## Room UX (opt-in, keep connection)

- The Mux player is primary. Below it, "Jonli xonaga qo‘shilish" mounts `MeetRoom` (join, camera/mic, chat, hand raise).
- "Yashirish" hides the room (`hidden` attribute) — `MeetRoom` stays mounted, the WebRTC connection and attendance interval continue. "Ko‘rsatish" reveals it.
- "Xonadan chiqish" unmounts `MeetRoom` → signal `leave` → attendance interval closes.
- While the Mux player is active the teacher's WebRTC tile is muted (`suppressTeacherAudio`) so audio is not doubled.
- Tradeoff: while hidden, the teacher's WebRTC video still downloads (connection kept on purpose).
- No auto-join on the Mux path, so a teacher/admin opening `/learn` alongside the studio does not create a second moderator connection.

## Attendance (explicit product rule: `webrtc_only`)

- Watching the Mux player is **not** attendance.
- With the flag effective, `/learn` does not upsert `Attendance` on page load for live lessons.
- `POST /api/live/join` (student, phase `live`) upserts `Attendance` (history) and, with `FF_LIVE_ATTENDANCE_V3`, opens an `AttendanceInterval`; leave / stale peer closes it.
- UI states: "Davomat jonli xonaga qo‘shilganda hisoblanadi."

## Mux calls in request paths

- `src/lib/mux-client.ts` (server-only guard): `muxGet` with `AbortSignal.timeout(2500ms)`, typed `MuxClientError` (`not_configured | timeout | network | http`), no response bodies, no audit counters. `mux-read-only.ts` stays audit-only.
- `getLiveMuxStatus`: 10 s cache (5 s for degraded), in-flight dedupe, bounded map; degraded results log one JSON line `{"event":"live_mux.status_degraded","reason",...}`.
- Degraded (timeout / Mux down): status `unknown`, `/learn` renders, the stage shows "Efir holatini hozir tekshirib bo‘lmadi" and the room stays usable.
- `/end` completes the Mux stream through `completeMuxLiveStream` (5 s timeout, never throws). Previously the call had no timeout and ignored the HTTP status: a hung Mux stalled `/end`, a network error returned 500 with the lesson still live, and a rejected request left the stream uncompleted silently. Failures now log `{"event":"live_mux.complete_failed","reason","status",...}` and the lesson still ends. Applies with the flag off too.

## Polling and rate limit

- Client (`live-mux-poll.ts`): idle 15 s, active 30 s, errors back off 30 → 60 → 120 s (cap), honours `Retry-After`, pauses while the tab is hidden, stops on 401/403/404/409 (refreshes once so an ended lesson switches view), stops on unmount.
- Server: 12 requests / minute per user (or IP) per lesson → `429 RATE_LIMITED` + `Retry-After: 30`. All responses `Cache-Control: no-store`.

## Signed playback

- Signing stays disabled: no `MUX_SIGNING_KEY_ID` / `MUX_SIGNING_PRIVATE_KEY`, no placeholder key.
- Live streams are still created with `playback_policy: ["public"]`; the player URL is public for the stream's lifetime. Authorization limits who receives it, not who can replay a leaked URL.
- To enable: add signing keys, create new live streams with a signed policy, return `{ mode: "signed", playerUrl: muxSignedPlayerUrl(id, token) }` from `resolveLivePlaybackSource`.

## `/shorts`

With the flag effective, each live lesson goes through `authorizeLiveMuxPlayback`; denied lessons are dropped (teachers/admins no longer see other teachers' live streams) and the player URL is included only while active. Flag off keeps the legacy feed.

## Stream key

Never returned by `/api/live/mux-playback`, `/learn`, or `/shorts`. Only the teacher's studio receives it (`/start`).
