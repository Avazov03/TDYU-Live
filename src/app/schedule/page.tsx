import { AppShell } from "@/components/layout/AppShell";
import { ScheduleBoard } from "@/components/cabinet/ScheduleBoard";
import { getStudentOwnedCourseIds, requireStudentCabinet } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { hasPlayableRecording } from "@/lib/plan";
import { DEFAULT_LESSON_MINUTES } from "@/lib/schedule-policy";
import type { LessonStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const OPEN_STATUSES: LessonStatus[] = ["live", "lobby", "waiting_room", "paused"];

export default async function SchedulePage() {
  const { user } = await requireStudentCabinet("/schedule");
  const courseIds = await getStudentOwnedCourseIds(user.id);

  const lessons = await prisma.lesson.findMany({
    where: { courseId: { in: courseIds } },
    include: {
      course: { include: { teacher: { select: { fullName: true } } } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const now = new Date();

  return (
    <AppShell active="schedule">
      <ScheduleBoard
        lessons={lessons.map((lesson) => {
          const endsAt =
            lesson.scheduledEndAt ??
            new Date(
              lesson.scheduledAt.getTime() +
                (lesson.durationMinutes ?? DEFAULT_LESSON_MINUTES) * 60_000,
            );
          const open = OPEN_STATUSES.includes(lesson.status);
          return {
            id: lesson.id,
            title: lesson.titleUz,
            when: lesson.scheduledAt.toISOString(),
            endsAt: endsAt.toISOString(),
            teacher: lesson.course.teacher.fullName,
            course: lesson.course.titleUz,
            summary: lesson.topicUz?.trim() || lesson.summaryUz?.trim() || null,
            status: lesson.status,
            hasRecording: hasPlayableRecording(lesson.recordingUrl, lesson.muxVodPlaybackId),
            upcoming:
              open || ((lesson.status === "scheduled" || lesson.status === "cancelled") && endsAt >= now),
          };
        })}
      />
    </AppShell>
  );
}
