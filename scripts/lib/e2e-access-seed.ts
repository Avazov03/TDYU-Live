/**
 * Enrollment-authoritative access fixtures for `e2e/access`, shared by the staging
 * refresh script and the hermetic E2E seed.
 *
 * Touches only the fixed fixture courses in ACCESS_FIXTURES and the fixture student's
 * Enrollment/Subscription rows on those courses. Scenarios (lessons are ended, no recording):
 *   completed — course completed, Enrollment completed + accessOpen, legacy Subscription EXPIRED → ALLOW
 *   refunded  — Enrollment refunded, accessOpen=false                                           → DENY
 *   closed    — Enrollment cancelled, accessOpen=false                                          → DENY
 *   legacy    — active legacy Subscription (t3, +1 year), NO Enrollment                          → DENY
 *   second    — active Enrollment                                                                → ALLOW
 */

import type { createSeedClient } from "../../src/lib/prisma";
import { ACCESS_FIXTURES, STAGING_FIXTURE } from "../../e2e/helpers/test-data";

type SeedClient = ReturnType<typeof createSeedClient>;

const DAY = 86_400_000;

export async function seedAccessFixtures(prisma: SeedClient, now = Date.now()) {
  const studentId = STAGING_FIXTURE.studentId;
  const template = await prisma.course.findUnique({
    where: { id: STAGING_FIXTURE.courseId },
    select: { teacherId: true, facultyId: true, subjectId: true },
  });
  if (!template) throw new Error(`Template course ${STAGING_FIXTURE.courseId} (Fixture Course A) is missing`);
  const student = await prisma.user.findUnique({ where: { id: studentId }, select: { id: true } });
  if (!student) throw new Error(`Fixture student ${studentId} is missing`);

  const courseIds = Object.values(ACCESS_FIXTURES).map((f) => f.courseId);

  for (const [key, f] of Object.entries(ACCESS_FIXTURES)) {
    const course = {
      ...template,
      titleUz: f.courseTitle,
      descriptionUz: `E2E access fixture (${key}).`,
      priceT1: 100000,
      priceT2: 200000,
      priceT3: 300000,
      listPrice: 200000,
      isPublished: true,
      lifecycleStatus: key === "completed" ? ("completed" as const) : ("active" as const),
    };
    await prisma.course.upsert({ where: { id: f.courseId }, update: course, create: { id: f.courseId, ...course } });

    const lesson = {
      courseId: f.courseId,
      titleUz: f.lessonTitle,
      scheduledAt: new Date(now - 20 * DAY),
      status: "ended" as const,
      recordingUrl: null,
      muxVodPlaybackId: null,
    };
    await prisma.lesson.upsert({ where: { id: f.lessonId }, update: lesson, create: { id: f.lessonId, ...lesson } });
  }

  await prisma.$transaction([
    prisma.enrollment.deleteMany({ where: { userId: studentId, courseId: { in: courseIds } } }),
    prisma.subscription.deleteMany({ where: { userId: studentId, courseId: { in: courseIds } } }),
    prisma.enrollment.create({
      data: {
        userId: studentId,
        courseId: ACCESS_FIXTURES.completed.courseId,
        status: "completed",
        accessOpen: true,
        activatedAt: new Date(now - 60 * DAY),
        completedAt: new Date(now - 10 * DAY),
      },
    }),
    prisma.subscription.create({
      data: {
        userId: studentId,
        courseId: ACCESS_FIXTURES.completed.courseId,
        tier: "t2",
        startsAt: new Date(now - 60 * DAY),
        endsAt: new Date(now - 30 * DAY),
      },
    }),
    prisma.enrollment.create({
      data: {
        userId: studentId,
        courseId: ACCESS_FIXTURES.refunded.courseId,
        status: "refunded",
        accessOpen: false,
        activatedAt: new Date(now - 15 * DAY),
        closedAt: new Date(now - 5 * DAY),
      },
    }),
    prisma.enrollment.create({
      data: {
        userId: studentId,
        courseId: ACCESS_FIXTURES.closed.courseId,
        status: "cancelled",
        accessOpen: false,
        activatedAt: new Date(now - 15 * DAY),
        closedAt: new Date(now - 5 * DAY),
      },
    }),
    prisma.subscription.create({
      data: {
        userId: studentId,
        courseId: ACCESS_FIXTURES.legacy.courseId,
        tier: "t3",
        startsAt: new Date(now - DAY),
        endsAt: new Date(now + 365 * DAY),
      },
    }),
    prisma.enrollment.create({
      data: {
        userId: studentId,
        courseId: ACCESS_FIXTURES.second.courseId,
        status: "active",
        accessOpen: true,
        activatedAt: new Date(now - 7 * DAY),
      },
    }),
  ]);

  const seats = await prisma.enrollment.findMany({
    where: { userId: studentId, courseId: { in: courseIds } },
    select: { courseId: true, status: true, accessOpen: true },
  });
  const subs = await prisma.subscription.findMany({
    where: { userId: studentId, courseId: { in: courseIds } },
    select: { courseId: true, tier: true, endsAt: true },
  });
  return { seats, subs };
}
