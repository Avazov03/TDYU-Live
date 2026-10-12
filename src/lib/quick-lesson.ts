export const QUICK_LESSON_TITLE = "Jonli dars";

/**
 * «Hozir dars o‘tish» lessons are created at their own start time; planned lessons must be in the future.
 * Such a lesson exists only for its waiting room — if it never airs, it is removed instead of lingering in the plan.
 */
export function isQuickLesson(lesson: { scheduledAt: Date; createdAt: Date }): boolean {
  return Math.abs(lesson.scheduledAt.getTime() - lesson.createdAt.getTime()) < 5_000;
}
