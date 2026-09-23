# PART 6 — Course / Lesson / Live / Recording / Attendance / Progress

## 6.1 Course lifecycle

**Statuses draft / active / paused / ended / archived: IMPLEMENTED EMAS.**
Only `Course.isPublished` boolean (default **true**).

### Who creates

1. `ensureTeacherWorkspace(teacherId)` (`src/lib/teacher-workspace.ts`)
   If teacher has zero courses: create title=`subject.nameUz`, description template, prices=`PLATFORM_PRICES`, published default true.
   Called from: enroll, invite accept, teacher home, teacher reja, teacher group, quick-live, admin teacher create.

2. `POST /api/teacher/courses` — teacher plan: title, N lessons, interval, firstAt. Prices platform. `isPublished: true`. Notify system on empty course.

3. `POST /api/admin/courses` — admin sets prices/teacher/faculty/subject.

4. Seed.

### Who edits

- Admin PATCH: title, description, teacher, faculty, subject, prices, isPublished.
- Enroll: `isPublished: true`.
- **Teacher has no course update/delete API.**

### Teacher “create course” UX

`/teacher` or `/teacher/reja` → `CreateCoursePlanForm` → POST teacher/courses → N `scheduled` lessons titled `"1-dars"` / firstTitle.

### Unpublished

`/courses/[id]` uses `findUnique({ where: { id, isPublished: true } })` → notFound if unpublished.
Student subs on unpublished course: `getActiveSubscriptions` still returns them (`isPublished` selected but **not filtered**). Lessons still accessible via `/learn` if subscription exists.

## 6.2 Lesson lifecycle

Prisma `LessonStatus`: `scheduled | lobby | live | ended`.

| Status | When | Who | Student UI | Can do | Access |
|--------|------|-----|------------|--------|--------|
| scheduled | create / quick-live | teacher POST lessons / courses / quick-live | “Reja”; learn paywall `not_started` | teacher: patch, delete, open lobby, jump to start | getLessonAccess false |
| lobby | POST `.../lobby` from scheduled | teacher | “Kutish”; MeetRoom if t2/t3 | wait in UI; **signal API rejects** (not live) | live_locked if t1; else ok |
| live | POST `.../start` from lobby **or scheduled** | teacher | “Jonli”; MeetRoom | WebRTC if signal ok; t1 locked | t2/t3 |
| ended | POST `.../end` or Mux webhook | teacher / mux | “Ko‘rish” or “Yozuv kutilmoqda” | VOD/chat | all tiers if sub active |

**cancelled: IMPLEMENTED EMAS.**

### Transitions (code)

```
create → scheduled
scheduled → lobby     (lobby route; notify t2+ lesson_starting)
scheduled | lobby → live   (start route; Mux stream; notify t2+ lesson_live)
any → ended           (end route; no status guard in end/route.ts)
live → ended          (mux webhook video.asset.ready)
```

[FACT]
File: src/app/api/teacher/lessons/[id]/end/route.ts
Relevant code: no `if (status !== live)` guard
Meaning: teacher can end a **scheduled** lesson (sets ended, optional recording).

[FACT]
File: src/app/api/teacher/lessons/[id]/route.ts
PATCH: blocked if live|lobby; scheduledAt change only if scheduled
DELETE: only scheduled

Quick-live: if any live lesson exists for teacher, return it `alreadyLive`; else create **scheduled** titled “Jonli dars” **without auto lobby/start**. UI must still open studio and press start.

### Mux webhook vs teacher end

Webhook sets `status: ended` + `muxVodPlaybackId` when asset ready. Can fire after teacher already ended. Overwrites status to ended again.

## 6.3 Live system (how it actually works)

Two layers:

1. **Classroom WebRTC** — `MeetRoom` polls `/api/live/signal` (join/poll/signal/event). Rooms in `globalThis.__tdyuLiveRooms` Map. Not shared across Node processes. Peer TTL 20s. STUN public servers, **no TURN**.

2. **Optional Mux RTMP** — on start, `createLiveStreamOrDemo`. LiveStudio shows RTMP URL + stream key if not `demo_`. Student learn page prefers MeetRoom when `canJoinLive`, **not** Mux iframe, for live/lobby.

Learn live playback mux iframe is only in the `canWatchVod && playbackId && !demo_` branch **after** `canJoinLive` is false. So t2 in live uses MeetRoom, not Mux player.

Moderator = admin or course teacher (`liveGate` / learn `staffJoin`). Students join with mic/cam off until grant.

Lobby UI: MeetRoom `phase="lobby"`.
[FACT]
File: src/app/api/live/signal/route.ts `liveGate`
Relevant code: `lesson.status !== "live"` → `{ ok: false }` **including moderators**
Meaning: **lobby MeetRoom cannot join the signaling room.** Buttons still render; `api()` throws “Ruxsat yo'q”.

Recording from MeetRoom: `MediaRecorder` webm; on teacher End, `saveRecording()` then POST end with `recordingUrl` (after upload via recording endpoint from LiveStudio — `saveRecording` returns URL from upload). LiveStudio `act("end")` calls `meetRef.saveRecording()` then end API.

## 6.4 Recording access vs tariff

- **Create:** teacher upload ≤120MB webm; and/or Mux VOD id; and/or end body `recordingUrl`.
- **Play:** learn page: local `/api/media/recording/[id]` if `recordingUrl`; else Mux iframe if playbackId not demo_; else placeholder “YOZUV KUTILMOQDA”.
- **When:** student needs `getLessonAccess` ok **or** staff. For ended, t1 is ok. For live, t1 is live_locked so they never get MeetRoom; they also fail canWatchVod for live... wait:

```
canJoinLive = (live|lobby) && (access.ok || staff)
canWatchVod = access.ok || staff
```

t1 live: access.ok false → no MeetRoom, no VOD branch, paywall `live_locked` (“Yozuv tugagach 1-tarifda ham ochiladi”).

t1 ended: access.ok true → can watch recording.

`hasPlayableRecording`: recordingUrl OR playbackId not starting with `demo_`. Demo mux ids are **not** playable.

media/recording GET: staff or getLessonAccess; path must start `uploads/recordings/`. Files also physically in `public/` (Next may static-serve them — **potential bypass**, see PART 11).

## 6.5 Student live timing

| Question | Code answer |
|----------|-------------|
| When lobby? | After teacher POST lobby; t2/t3 access.ok; MeetRoom shown; **signal fails** |
| When live? | After teacher start; t2/t3; MeetRoom + signal allowed |
| When recording? | After ended + playable file/mux; **all tiers** with active sub |
| Live tariff | t2, t3 (`canWatchLive`) |
| Recording tariff | any active subscription (t1 included) |

Admin/teacher of that course: staffJoin, no tariff.

## 6.6 Attendance

**Fields that exist:** `id`, `userId`, `lessonId`, `joinedAt`.
**Do not exist:** leftAt, duration, attendance status enum.

[FACT]
File: src/app/learn/[id]/page.tsx
Relevant code:
```
if (access.ok && session.user.id && (status live|lobby|ended)) {
  attendance.upsert({ update: {}, create: { userId, lessonId } })
}
```
Meaning: **opening the learn page** with access creates attendance. Not MeetRoom join. Not video play. `update: {}` so re-open does not refresh joinedAt.

scheduled: no attendance.
t1 live: no attendance (access not ok).
staff (teacher/admin) without student sub: **no** attendance (requires access.ok, not staffJoin).

**Used in**
- Student `/app` “Davom ettirish” = latest attendance
- `/history` “Ochgan darslaringiz” = attendance list take 50
- Teacher group `attendPct` = attended lessons / lessonCount (any attendance row)
- Admin course `attendancePct` = present seats / (active students × ended-or-attended lessons)

## 6.7 Progress formulas

### Learn page “Kurs progressi”

[FACT]
File: src/app/learn/[id]/page.tsx
Relevant code:
```
doneCount = playlist.filter(ended && hasPlayableRecording).length
progressPct = round(doneCount / playlist.length * 100)
UI: "{index+1}/{playlist.length} dars" and "{progressPct}% yozuv tayyor"
aria-label="Kurs progressi"
```
Meaning: **N/M is playlist position, not completion. % is recording readiness of the course, not the student.** Independent of attendance.

### Teacher studio course card `withVideo`

ended + hasPlayableRecording count vs total lessons (`teacher/page.tsx`).

### Teacher group student `pct`

`attended / course.lessons.length * 100` where attended = lessons with any attendance row for that user (**includes scheduled? only if they had access — they don't**). Counts lobby/live/ended opens. Includes lessons without recordings.

### Admin course health

`src/lib/admin-courses.ts` `healthOf`: live if liveCount>0; empty if no lessons; on_track if future scheduled; stale if ended and last lesson >14 days; else idle.

### Certificates empty state

Copy claims finish lessons+assignments; **no formula in issue API**.

### 5/7 style

If playlist has 7 lessons and 5 ended with playable VOD, learn shows `k/7 dars` (position) and `71% yozuv tayyor`. It does **not** mean the student watched 5.

END OF PART 6
