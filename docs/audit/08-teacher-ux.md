# PART 8 — Teacher UX

## 8.1 How a teacher account appears

1. Admin POST `/api/admin/teachers` → Teacher row + invite (14 days) + `ensureTeacherWorkspace`.
2. Email/notify contains `/invite/[token]`.
3. Teacher sets name+password POST `/api/auth/invite` → User role teacher, invite usedAt, workspace ensured.
4. Login `/login` → `/go` → `/teacher`.

If User.role is teacher but no Teacher profile: studio empty state “Admin sizni fan bilan bog'lagach…”.

Admin can also `ensureTeacherUser` via impersonate or password reset (creates user without invite).

## 8.2 Flow

| Stage | Screen | CTA | API | DB | Next |
|-------|--------|-----|-----|-----|------|
| Login | `/login` | | NextAuth | lastLogin | `/teacher` |
| Studio | `/teacher` | course cards “Studioga — shu dars”; SoftDisclosure new course; QuickLive | ensureTeacherWorkspace SSR; POST teacher/courses; POST quick-live | course/lessons | `/teacher/live/[id]` |
| Reja | `/teacher/reja` | create course / create lesson / board actions | POST lessons, PATCH/DELETE lesson | lessons | refresh / live |
| Live studio | `/teacher/live/[lessonId]` | Kutish / Boshlash / Tugatish | lobby, start, end, recording | status, mux, recordingUrl | refresh or `/teacher` |
| Group | `/teacher/group` | Sertifikat berish | POST certificates | Certificate | refresh |
| Assignments | `/teacher/assignments` | create, GradeForm | POST assignments, POST grades | Assignment, Submission | refresh |
| Settings | `/settings` | telegram | PATCH telegram | | |

**No dedicated teacher analytics page.** Studio KPIs: course count, next countdown, ungraded submissions, running live/lobby count. Group has attend %.

## 8.3 Studio home (`/teacher`)

- Redirect if not teacher.
- `ensureTeacherWorkspace`.
- KPIs + alert stack for live/lobby lessons.
- Course cards: phase new/planned/ongoing/active; withVideo count; activeStudents; actionable lessons → live studio.
- `CreateCoursePlanForm` in disclosure.
- Dead components **not used**: `TeacherHub.tsx`, `TeacherStudioFocus.tsx`.

## 8.4 Reja (`/teacher/reja`)

CreateCoursePlanForm + CreateLessonForm + TeacherRejaBoard (schedule table, edit panel, lesson actions: lobby/start/end/delete).

## 8.5 Live studio (`LiveStudio.tsx`)

- scheduled: button open lobby; can also start (API allows scheduled→live).
- lobby: MeetRoom phase lobby; start button; RTMP key after start.
- live: MeetRoom live; end uploads recording then POST end; closeLiveRoom.
- OBS: CopyField RTMP + key if not demo_.
- LessonInventory for assets (present files).

QuickLiveButton: POST quick-live → navigate to `/teacher/live/{id}` (lesson still **scheduled** unless alreadyLive).

## 8.6 Group (`TeacherGroupBoard`)

Per course: activeCount, t1/t2/t3 counts, attendPct, student list with attended/lessonCount/pct, seenTitles, hasCert, IssueCertificateButton.

**No server check** that student completed anything before cert.

## 8.7 Assignments + grading

CreateAssignmentForm: course, title, description, dueAt. Notifies all active subs (all tiers).

GradeForm: 0–100 + note. Notifies student type grade.

List sorted so t3 submissions appear first (`tierRank`). Missing students listed. Late flag if dueAt < now. **Submit after due still accepted.**

## 8.8 Teacher cannot (in UI/API)

- Unpublish own course
- Delete course
- Change prices (admin only)
- See payments
- Block students
- Access other teachers’ lessons (ownedLesson filter)

END OF PART 8
