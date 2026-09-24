/**
 * Deterministic course/lesson IDs for browser E2E.
 *
 * Defaults = prisma/seed.ts (local).
 * Override via env for staging Phase-2 fixtures (see docs/qa/BROWSER-E2E.md).
 */

export const SEED = {
  courseCivilBasics:
    process.env.E2E_COURSE_ID?.trim() || "44444444-4444-4444-4444-444444444401",
  courseContract: process.env.E2E_COURSE_ID_B?.trim() || "44444444-4444-4444-4444-444444444402",
  lessonIntro: process.env.E2E_LESSON_ID?.trim() || "55555555-5555-5555-5555-555555555501",
  lessonContracts: process.env.E2E_LESSON_ID_B?.trim() || "55555555-5555-5555-5555-555555555502",
  courseTitleCivil:
    process.env.E2E_COURSE_TITLE?.trim() || "Fuqarolik huquqi: asoslar",
  lessonTitleIntro:
    process.env.E2E_LESSON_TITLE?.trim() || "Kirish: fuqarolik huquqi tizimi",
} as const;

/** Documented staging Phase-2 fixture map (passwords via E2E_* env only). */
export const STAGING_FIXTURE = {
  studentEmail: "fixture.active1@lexify.local",
  teacherEmail: "fixture.teacher@lexify.local",
  adminEmail: "staging.admin@lexify.local",
  studentId: "a6666666-6666-6666-6666-666666666611",
  courseId: "a4444444-4444-4444-4444-444444444401",
  courseTitle: "Fixture Course A",
  enrollmentId: "7a0499ee-d997-4e83-8481-86306db81433",
  lessonId: "a5555555-5555-5555-5555-555555555501",
  lessonTitle: "Fixture ended lesson",
  /** Checkout V2 browser target — RFC UUID (Zod-strict); staging fixture. */
  checkoutV2CourseId: "b2500001-0000-4000-8000-000000000025",
  checkoutV2CourseTitle: "Phase 2.5 Checkout E2E Course",
  checkoutV2ListPrice: 250000,
  checkoutV2LessonId: "b2500001-0000-4000-8000-000000000026",
  checkoutV2LessonTitle: "Phase 2.5 E2E lesson",
} as const;
