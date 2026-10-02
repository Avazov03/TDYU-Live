/**
 * Hermetic E2E seed — builds every fixture the Playwright suites need on an empty,
 * freshly migrated database (IDs/titles: e2e/helpers/test-data.ts).
 *
 * Wipes ALL application tables first, so it only runs against a local database whose
 * name ends with `_e2e` (see docker-compose.e2e.yml). Refuses NODE_ENV=production.
 *
 * Usage: npm run test:e2e:full (runner calls this), or
 *   DATABASE_URL=postgresql://lexify:lexify@localhost:54329/lexify_e2e npx tsx scripts/e2e-hermetic-seed.ts
 */

import { createSeedClient } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/password";
import { STAGING_FIXTURE } from "../e2e/helpers/test-data";
import { seedAccessFixtures } from "./lib/e2e-access-seed";
import { seedFlowFixtures } from "./lib/e2e-flow-seed";
import { E2E_FIXTURE_TEACHER_ID, E2E_OWNED_LESSON_IDS } from "../src/lib/e2e-fixture-reset";

const DAY = 86_400_000;
const PASSWORD = "demo1234";

const IDS = {
  faculty: "a1111111-1111-1111-1111-111111111101",
  subject1: "a2222222-2222-2222-2222-222222222201",
  subject2: "a2222222-2222-2222-2222-222222222202",
  teacherUser: "a6666666-6666-6666-6666-666666666602",
  admin: "a6666666-6666-6666-6666-666666666699",
  courseAPurchase: "83c4d585-403d-4b5b-b8c7-67efcb3cee77",
};

const OWNED_LESSON_TITLES: Record<(typeof E2E_OWNED_LESSON_IDS)[number], string> = {
  [STAGING_FIXTURE.liveLessonId]: STAGING_FIXTURE.liveLessonTitle,
  [STAGING_FIXTURE.liveLessonIdWave3]: STAGING_FIXTURE.liveLessonTitleWave3,
  [STAGING_FIXTURE.recordingLessonId]: STAGING_FIXTURE.recordingLessonTitle,
  [STAGING_FIXTURE.recordingLessonIdWave2]: STAGING_FIXTURE.recordingLessonTitleWave2,
  [STAGING_FIXTURE.recordingLessonIdWave3]: STAGING_FIXTURE.recordingLessonTitleWave3,
  [STAGING_FIXTURE.liveMuxLessonId]: STAGING_FIXTURE.liveMuxLessonTitle,
};

function assertHermeticTarget() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed with NODE_ENV=production");
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set");
  const url = new URL(raw);
  const db = url.pathname.replace(/^\//, "");
  const local = ["localhost", "127.0.0.1", "::1", "postgres"].includes(url.hostname);
  if (!local || !db.endsWith("_e2e")) {
    throw new Error(`Refusing to wipe "${url.hostname}/${db}": hermetic seed needs a local *_e2e database.`);
  }
  return db;
}

async function main() {
  const db = assertHermeticTarget();
  const prisma = createSeedClient();
  const now = Date.now();

  try {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    if (tables.length) {
      await prisma.$executeRawUnsafe(
        `TRUNCATE TABLE ${tables.map((t) => `"public"."${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`,
      );
    }

    const passwordHash = await hashPassword(PASSWORD);
    await prisma.user.createMany({
      data: [
        { id: STAGING_FIXTURE.studentId, fullName: "Fixture Active One", email: STAGING_FIXTURE.studentEmail, passwordHash, role: "student" },
        { id: IDS.teacherUser, fullName: "Fixture Teacher", email: STAGING_FIXTURE.teacherEmail, passwordHash, role: "teacher" },
        { id: IDS.admin, fullName: "Staging Admin", email: STAGING_FIXTURE.adminEmail, passwordHash, role: "admin" },
      ],
    });

    await prisma.faculty.create({
      data: { id: IDS.faculty, nameUz: "Fixture fakultet", nameRu: "Fixture", nameEn: "Fixture", order: 99 },
    });
    await prisma.subject.createMany({
      data: [
        { id: IDS.subject1, facultyId: IDS.faculty, nameUz: "Fixture fan 1", nameRu: "F1", nameEn: "S1" },
        { id: IDS.subject2, facultyId: IDS.faculty, nameUz: "Fixture fan 2", nameRu: "F2", nameEn: "S2" },
      ],
    });
    await prisma.teacher.create({
      data: {
        id: E2E_FIXTURE_TEACHER_ID,
        userId: IDS.teacherUser,
        facultyId: IDS.faculty,
        subjectId: IDS.subject1,
        fullName: "Fixture Teacher",
        contactEmail: STAGING_FIXTURE.teacherEmail,
      },
    });

    const owned = { teacherId: E2E_FIXTURE_TEACHER_ID, facultyId: IDS.faculty, isPublished: true };
    await prisma.course.createMany({
      data: [
        {
          ...owned,
          id: STAGING_FIXTURE.courseId,
          subjectId: IDS.subject1,
          titleUz: STAGING_FIXTURE.courseTitle,
          descriptionUz: "Active + multi mapping",
          priceT1: 150000,
          priceT2: 250000,
          priceT3: 400000,
        },
        {
          ...owned,
          id: STAGING_FIXTURE.checkoutV2CourseId,
          subjectId: IDS.subject2,
          titleUz: STAGING_FIXTURE.checkoutV2CourseTitle,
          descriptionUz: "Checkout V2 E2E course.",
          priceT1: 180000,
          priceT2: 280000,
          priceT3: 450000,
          listPrice: STAGING_FIXTURE.checkoutV2ListPrice,
          lifecycleStatus: "active",
        },
        {
          ...owned,
          id: STAGING_FIXTURE.denyCourseId,
          subjectId: IDS.subject1,
          titleUz: STAGING_FIXTURE.denyCourseTitle,
          descriptionUz: "Never purchased by the fixture student.",
          priceT1: 250000,
          priceT2: 250000,
          priceT3: 250000,
          listPrice: 250000,
          lifecycleStatus: "active",
        },
      ],
    });

    // Owned live/recording lessons start just in the past, matching what POST /api/e2e/fixture-reset restores.
    const ownedStart = new Date(now - 5 * 60_000);
    await prisma.lesson.createMany({
      data: [
        {
          id: STAGING_FIXTURE.lessonId,
          courseId: STAGING_FIXTURE.courseId,
          titleUz: STAGING_FIXTURE.lessonTitle,
          scheduledAt: new Date(now - 3 * DAY),
          status: "ended",
          muxVodPlaybackId: "fixture_vod",
        },
        ...E2E_OWNED_LESSON_IDS.map((id) => ({
          id,
          courseId: STAGING_FIXTURE.courseId,
          titleUz: OWNED_LESSON_TITLES[id],
          scheduledAt: ownedStart,
          status: "scheduled" as const,
        })),
        {
          id: STAGING_FIXTURE.checkoutV2LessonId,
          courseId: STAGING_FIXTURE.checkoutV2CourseId,
          titleUz: STAGING_FIXTURE.checkoutV2LessonTitle,
          scheduledAt: new Date(now - 10 * DAY),
          status: "ended",
        },
        {
          id: STAGING_FIXTURE.denyLessonId,
          courseId: STAGING_FIXTURE.denyCourseId,
          titleUz: STAGING_FIXTURE.denyLessonTitle,
          scheduledAt: new Date(now - 30 * DAY),
          status: "ended",
        },
      ],
    });

    await prisma.purchase.create({
      data: {
        id: IDS.courseAPurchase,
        userId: STAGING_FIXTURE.studentId,
        courseId: STAGING_FIXTURE.courseId,
        amountPaid: 0,
        status: "completed",
        legacyBackfill: true,
        legacyTier: "t2",
        completedAt: new Date(now - 5 * DAY),
      },
    });
    await prisma.enrollment.create({
      data: {
        id: STAGING_FIXTURE.enrollmentId,
        userId: STAGING_FIXTURE.studentId,
        courseId: STAGING_FIXTURE.courseId,
        purchaseId: IDS.courseAPurchase,
        status: "active",
        accessOpen: true,
        activatedAt: new Date(now - 5 * DAY),
      },
    });
    await prisma.subscription.create({
      data: {
        userId: STAGING_FIXTURE.studentId,
        courseId: STAGING_FIXTURE.courseId,
        tier: "t2",
        startsAt: new Date(now - 5 * DAY),
        endsAt: new Date(now + 25 * DAY),
      },
    });

    const access = await seedAccessFixtures(prisma, now);
    await seedFlowFixtures(prisma, { facultyId: IDS.faculty, subjectId: IDS.subject1, subject2Id: IDS.subject2, now });
    console.log(
      JSON.stringify({ ok: true, db, truncatedTables: tables.length, accessSeats: access.seats.length }, null, 2),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
