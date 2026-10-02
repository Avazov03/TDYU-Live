/**
 * Staging/local ONLY — Enrollment-authoritative access fixtures for `e2e/access`.
 *
 * Idempotent. Touches only the fixed fixture courses below and fixture.active1's
 * Enrollment/Subscription rows on those courses. Never deletes users or other data.
 *
 * Scenarios (all for fixture.active1, lessons are ended so the paywall vs. replay card is visible):
 *   completed — course lifecycle completed, Enrollment completed + accessOpen, legacy Subscription EXPIRED → ALLOW
 *   refunded  — Enrollment refunded, accessOpen=false                                                   → DENY
 *   closed    — Enrollment cancelled, accessOpen=false                                                  → DENY
 *   legacy    — active legacy Subscription (t3, +1 year), NO Enrollment                                  → DENY
 *
 * Refuses unless the database name ends with `_staging`, or the target is a non-production local DB.
 *
 * Usage (staging app dir):  npx tsx scripts/e2e-access-fixtures.ts
 */

import "dotenv/config";
import { createSeedClient } from "../src/lib/prisma";

const STUDENT_ID = "a6666666-6666-6666-6666-666666666611";
const TEMPLATE_COURSE_ID = "a4444444-4444-4444-4444-444444444401";
const DAY = 86_400_000;

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
} as const;

function assertSafeTarget() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set");
  const url = new URL(raw);
  const db = url.pathname.replace(/^\//, "");
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  const staging = db.endsWith("_staging");
  const localDev = local && process.env.NODE_ENV !== "production" && !/lexify\.zonic\.fit/i.test(process.env.NEXTAUTH_URL ?? "");
  if (!staging && !localDev) {
    throw new Error(`Refusing to write access fixtures to database "${db}" (not *_staging / local dev).`);
  }
  return db;
}

async function main() {
  const db = assertSafeTarget();
  const prisma = createSeedClient();
  const now = Date.now();

  try {
    const template = await prisma.course.findUnique({
      where: { id: TEMPLATE_COURSE_ID },
      select: { teacherId: true, facultyId: true, subjectId: true },
    });
    if (!template) throw new Error(`Template course ${TEMPLATE_COURSE_ID} (Fixture Course A) is missing`);
    const student = await prisma.user.findUnique({ where: { id: STUDENT_ID }, select: { id: true } });
    if (!student) throw new Error(`Fixture student ${STUDENT_ID} is missing`);

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
      prisma.enrollment.deleteMany({ where: { userId: STUDENT_ID, courseId: { in: courseIds } } }),
      prisma.subscription.deleteMany({ where: { userId: STUDENT_ID, courseId: { in: courseIds } } }),
      prisma.enrollment.create({
        data: {
          userId: STUDENT_ID,
          courseId: ACCESS_FIXTURES.completed.courseId,
          status: "completed",
          accessOpen: true,
          activatedAt: new Date(now - 60 * DAY),
          completedAt: new Date(now - 10 * DAY),
        },
      }),
      prisma.subscription.create({
        data: {
          userId: STUDENT_ID,
          courseId: ACCESS_FIXTURES.completed.courseId,
          tier: "t2",
          startsAt: new Date(now - 60 * DAY),
          endsAt: new Date(now - 30 * DAY),
        },
      }),
      prisma.enrollment.create({
        data: {
          userId: STUDENT_ID,
          courseId: ACCESS_FIXTURES.refunded.courseId,
          status: "refunded",
          accessOpen: false,
          activatedAt: new Date(now - 15 * DAY),
          closedAt: new Date(now - 5 * DAY),
        },
      }),
      prisma.enrollment.create({
        data: {
          userId: STUDENT_ID,
          courseId: ACCESS_FIXTURES.closed.courseId,
          status: "cancelled",
          accessOpen: false,
          activatedAt: new Date(now - 15 * DAY),
          closedAt: new Date(now - 5 * DAY),
        },
      }),
      prisma.subscription.create({
        data: {
          userId: STUDENT_ID,
          courseId: ACCESS_FIXTURES.legacy.courseId,
          tier: "t3",
          startsAt: new Date(now - DAY),
          endsAt: new Date(now + 365 * DAY),
        },
      }),
    ]);

    const seats = await prisma.enrollment.findMany({
      where: { userId: STUDENT_ID, courseId: { in: courseIds } },
      select: { courseId: true, status: true, accessOpen: true },
    });
    const subs = await prisma.subscription.findMany({
      where: { userId: STUDENT_ID, courseId: { in: courseIds } },
      select: { courseId: true, tier: true, endsAt: true },
    });
    console.log(JSON.stringify({ ok: true, db, seats, subs }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
