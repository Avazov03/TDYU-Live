import type { CourseLifecycleStatus, LessonStatus } from "@/generated/prisma/client";

export type CourseCompletionCheck =
  | { ok: true }
  | { ok: false; code: "INVALID_STATE" | "OPEN_LESSONS"; message: string };

const OPEN_LESSON_STATUSES: readonly LessonStatus[] = [
  "scheduled",
  "lobby",
  "waiting_room",
  "live",
  "paused",
];

export function isOpenLessonStatus(status: LessonStatus): boolean {
  return OPEN_LESSON_STATUSES.includes(status);
}

/**
 * Completion follows teaching, not attendance: an ACTIVE course (first lesson already taught)
 * can be finished once nothing is scheduled, waiting or live.
 */
export function checkCourseCompletion(input: {
  lifecycleStatus: CourseLifecycleStatus | null;
  lessonStatuses: LessonStatus[];
}): CourseCompletionCheck {
  if (input.lifecycleStatus !== "active") {
    return {
      ok: false,
      code: "INVALID_STATE",
      message: "Faqat boshlangan (faol) kursni yakunlash mumkin",
    };
  }
  const open = input.lessonStatuses.filter(isOpenLessonStatus).length;
  if (open > 0) {
    return {
      ok: false,
      code: "OPEN_LESSONS",
      message: `Kursda ${open} ta o‘tkazilmagan dars bor — avval ularni o‘tkazing yoki rejadan olib tashlang`,
    };
  }
  return { ok: true };
}
