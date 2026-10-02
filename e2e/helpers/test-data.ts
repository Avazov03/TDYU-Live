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
  /** Checkout V2 browser target — RFC UUID (Zod-strict); staging disposable fixture. */
  checkoutV2CourseId: "b2500001-0000-4000-8000-000000000025",
  checkoutV2CourseTitle: "Phase 5 Wave 5 Checkout E2E Course",
  checkoutV2ListPrice: 250000,
  checkoutV2LessonId: "b2500001-0000-4000-8000-000000000026",
  checkoutV2LessonTitle: "Phase 5 Wave 5 E2E lesson",
  /** Never purchased by fixture.active1 — Wave 5+ deny / isolation probe. */
  denyCourseId: "c2500001-0000-4000-8000-000000000035",
  denyCourseTitle: "Phase 5 Wave 5 Deny Probe Course",
  denyLessonId: "c2500001-0000-4000-8000-000000000036",
  denyLessonTitle: "Phase 5 Wave 5 deny lesson",
  /** Phase 7 Live Wave 1 — scheduled lesson on Course A (staging seed). */
  liveLessonId: "d2500001-0000-4000-8000-000000000045",
  liveLessonTitle: "Phase 7 Live Wave 1 lesson",
  /** Phase 7 Live Wave 3 — separate lesson so attendance E2E does not fight Wave 1/2 fixture state. */
  liveLessonIdWave3: "d2500001-0000-4000-8000-000000000046",
  liveLessonTitleWave3: "Phase 7 Live Wave 3 attendance lesson",
  /** Phase 8 Recording Wave 1 — dedicated lesson on Course A. */
  recordingLessonId: "d2500001-0000-4000-8000-000000000047",
  recordingLessonTitle: "Phase 8 Recording Wave 1 lesson",
  /** Phase 8 Recording Wave 2 — separate so Wave 1 publish does not collide. */
  recordingLessonIdWave2: "d2500001-0000-4000-8000-000000000048",
  recordingLessonTitleWave2: "Phase 8 Recording Wave 2 signed playback lesson",
  /** Phase 8 Recording Wave 3 — legacy public VOD migration fixture. */
  recordingLessonIdWave3: "d2500001-0000-4000-8000-000000000049",
  recordingLessonTitleWave3: "Phase 8 Recording Wave 3 legacy migration lesson",
  /** Phase 8.5 — Mux live playback lesson on Course A (title is the Mux passthrough prefix). */
  liveMuxLessonId: "d2500001-0000-4000-8000-000000000050",
  liveMuxLessonTitle: "Phase 8.5 Mux live lesson",
} as const;

const flowId = (suffix: string) => `f2700001-0000-4000-8000-0000000000${suffix}`;

/**
 * Hermetic-only flow fixtures (seed: scripts/lib/e2e-flow-seed.ts). The flows mutate state
 * (refund, cancel, complete, certificates), so each has its own students and courses
 * owned by the fixture teacher, isolated from the shared fixture.active1 data.
 */
export const FLOW_FIXTURES = {
  password: process.env.E2E_FLOW_PASSWORD?.trim() || "demo1234",
  users: {
    refund1: { id: flowId("01"), email: "fixture.refund1@lexify.local", name: "Fixture Refund One" },
    cancel1: { id: flowId("02"), email: "fixture.cancel1@lexify.local", name: "Fixture Cancel One" },
    assign1: { id: flowId("03"), email: "fixture.assign1@lexify.local", name: "Fixture Assign One" },
    assign2: { id: flowId("04"), email: "fixture.assign2@lexify.local", name: "Fixture Assign Two" },
    cert1: { id: flowId("05"), email: "fixture.cert1@lexify.local", name: "Fixture Cert One" },
    teacher2: { id: flowId("06"), email: "fixture.teacher2@lexify.local", name: "Fixture Teacher Two" },
  },
  teacher2Id: flowId("07"),
  refund: {
    courseId: flowId("11"),
    courseTitle: "Flow Refund Half Course",
    lessonId: flowId("12"),
    lessonTitle: "Flow refund ended lesson",
    purchaseId: flowId("71"),
    amountPaid: 200000,
  },
  keep: { courseId: flowId("19"), courseTitle: "Flow Refund Keep Course", lessonId: flowId("1a") },
  cancel: {
    courseId: flowId("21"),
    courseTitle: "Flow Cancel Course",
    purchaseId: flowId("72"),
    amountPaid: 150000,
  },
  assignments: { courseId: flowId("31"), courseTitle: "Flow Assignments Course", lessonId: flowId("32") },
  completion: { courseId: flowId("41"), courseTitle: "Flow Completion Course" },
  certificate: { courseId: flowId("51"), courseTitle: "Flow Certificate Course" },
  otherTeacherCourse: { courseId: flowId("61"), courseTitle: "Flow Other Teacher Course" },
} as const;

/**
 * Enrollment-authoritative access fixtures for fixture.active1 (seed: scripts/lib/e2e-access-seed.ts).
 * All lessons are `ended` with no recording, so allowed = replay card, denied = paywall.
 */
export const ACCESS_FIXTURES = {
  completed: {
    courseId: "e2600001-0000-4000-8000-000000000061",
    courseTitle: "Access Fixture Completed Course",
    lessonId: "e2600001-0000-4000-8000-000000000062",
    lessonTitle: "Access fixture completed replay lesson",
  },
  refunded: {
    courseId: "e2600001-0000-4000-8000-000000000071",
    courseTitle: "Access Fixture Refunded Course",
    lessonId: "e2600001-0000-4000-8000-000000000072",
    lessonTitle: "Access fixture refunded lesson",
  },
  closed: {
    courseId: "e2600001-0000-4000-8000-000000000081",
    courseTitle: "Access Fixture Closed Course",
    lessonId: "e2600001-0000-4000-8000-000000000082",
    lessonTitle: "Access fixture closed lesson",
  },
  legacy: {
    courseId: "e2600001-0000-4000-8000-000000000091",
    courseTitle: "Access Fixture Legacy Subscription Course",
    lessonId: "e2600001-0000-4000-8000-000000000092",
    lessonTitle: "Access fixture legacy-only lesson",
  },
  /** Second open seat next to Course A, so Checkout V2 Course B can stay unowned. */
  second: {
    courseId: "e2600001-0000-4000-8000-0000000000a1",
    courseTitle: "Access Fixture Second Active Course",
    lessonId: "e2600001-0000-4000-8000-0000000000a2",
    lessonTitle: "Access fixture second active lesson",
  },
} as const;
