import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import {
  checkEarlyStart,
  lessonEnd,
  RUNNING_LESSON_STATUSES,
  type LessonWindow,
  type ScheduleCheck,
} from "@/lib/schedule-policy";

/** Opening the waiting room or going live now — blocked if another lesson runs/overlaps. */
export async function checkTeacherCanOpenNow(
  teacherId: string,
  lesson: { id: string; scheduledAt: Date; scheduledEndAt: Date | null; durationMinutes: number | null },
): Promise<ScheduleCheck> {
  const now = new Date();
  const minutes = lessonEnd(lesson).getTime() - lesson.scheduledAt.getTime();
  return checkEarlyStart({
    lessonId: lesson.id,
    now,
    durationEnd: new Date(now.getTime() + minutes),
    others: await loadTeacherLessonWindows(teacherId),
    formatWhen: formatDateTime,
  });
}

/** Teacher's open lessons (all courses) that can still collide with a new time. */
export async function loadTeacherLessonWindows(teacherId: string): Promise<LessonWindow[]> {
  const since = new Date(Date.now() - 24 * 3_600_000);
  const rows = await prisma.lesson.findMany({
    where: {
      course: {
        teacherId,
        OR: [
          { lifecycleStatus: null },
          { lifecycleStatus: { notIn: ["rejected", "cancelled", "archived"] } },
        ],
      },
      OR: [
        { status: "scheduled", scheduledAt: { gte: since } },
        { status: { in: [...RUNNING_LESSON_STATUSES] } },
      ],
    },
    select: {
      id: true,
      titleUz: true,
      scheduledAt: true,
      scheduledEndAt: true,
      durationMinutes: true,
      status: true,
      course: { select: { titleUz: true } },
    },
  });
  return rows.map((l) => ({
    id: l.id,
    titleUz: l.titleUz,
    courseTitleUz: l.course.titleUz,
    start: l.scheduledAt,
    end: lessonEnd(l),
    status: l.status,
  }));
}
