/**
 * Local/demo ONLY — production-like SHAPES for Phase 2 access mapping validation.
 *
 * Does NOT invent real production PII or copy production DBs.
 * Uses deterministic demo IDs (extends prisma/seed.ts patterns).
 * Creates LEGACY rows only (User/Course/Subscription/Entitlement/Payment).
 * Does NOT create Purchase / Enrollment / Refund.
 *
 * Blocked when NODE_ENV=production.
 *
 * Usage (local):
 *   npx tsx scripts/phase2-access-fixture.ts
 */

import "dotenv/config";
import { createSeedClient } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/password";
import { addDays } from "../src/lib/tariffs";

const prisma = createSeedClient();

const IDS = {
  f1: "a1111111-1111-1111-1111-111111111101",
  s1: "a2222222-2222-2222-2222-222222222201",
  s2: "a2222222-2222-2222-2222-222222222202",
  t1: "a3333333-3333-3333-3333-333333333301",
  c1: "a4444444-4444-4444-4444-444444444401",
  c2: "a4444444-4444-4444-4444-444444444402",
  c3: "a4444444-4444-4444-4444-444444444403",
  l1: "a5555555-5555-5555-5555-555555555501",
  l2: "a5555555-5555-5555-5555-555555555502",
  uTeacher: "a6666666-6666-6666-6666-666666666602",
  // Students covering mapping scenarios
  uActiveOne: "a6666666-6666-6666-6666-666666666611",
  uMulti: "a6666666-6666-6666-6666-666666666612",
  uExpired: "a6666666-6666-6666-6666-666666666613",
  uOrphanEnt: "a6666666-6666-6666-6666-666666666614",
  uT1Live: "a6666666-6666-6666-6666-666666666615",
  uNoPay: "a6666666-6666-6666-6666-666666666616",
};

async function wipeFixtureNamespace() {
  // Phase 1 children first (empty in dry validation; safe if present).
  await prisma.refund.deleteMany({
    where: { purchase: { userId: { startsWith: "a6666666" } } },
  }).catch(() => undefined);
  await prisma.enrollment.deleteMany({
    where: { userId: { startsWith: "a6666666" } },
  });
  await prisma.purchase.deleteMany({
    where: { userId: { startsWith: "a6666666" } },
  });
  await prisma.payment.deleteMany({
    where: { userId: { startsWith: "a6666666" } },
  });
  await prisma.subscription.deleteMany({
    where: { userId: { startsWith: "a6666666" } },
  });
  await prisma.entitlement.deleteMany({
    where: { userId: { startsWith: "a6666666" } },
  });
  await prisma.lesson.deleteMany({
    where: { id: { in: [IDS.l1, IDS.l2] } },
  });
  await prisma.course.deleteMany({
    where: { id: { in: [IDS.c1, IDS.c2, IDS.c3] } },
  });
  await prisma.teacher.deleteMany({ where: { id: IDS.t1 } });
  await prisma.subject.deleteMany({ where: { id: { in: [IDS.s1, IDS.s2] } } });
  await prisma.faculty.deleteMany({ where: { id: IDS.f1 } });
  await prisma.user.deleteMany({
    where: {
      id: {
        in: [
          IDS.uTeacher,
          IDS.uActiveOne,
          IDS.uMulti,
          IDS.uExpired,
          IDS.uOrphanEnt,
          IDS.uT1Live,
          IDS.uNoPay,
        ],
      },
    },
  });
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("XATO: phase2-access-fixture production'da taqiqlangan.");
    process.exit(1);
  }

  await wipeFixtureNamespace();

  const password = await hashPassword("demo1234");
  const now = new Date();

  await prisma.user.createMany({
    data: [
      {
        id: IDS.uTeacher,
        fullName: "Fixture Teacher",
        email: "fixture.teacher@lexify.local",
        passwordHash: password,
        role: "teacher",
      },
      {
        id: IDS.uActiveOne,
        fullName: "Fixture Active One",
        email: "fixture.active1@lexify.local",
        passwordHash: password,
        role: "student",
      },
      {
        id: IDS.uMulti,
        fullName: "Fixture Multi Course",
        email: "fixture.multi@lexify.local",
        passwordHash: password,
        role: "student",
      },
      {
        id: IDS.uExpired,
        fullName: "Fixture Expired",
        email: "fixture.expired@lexify.local",
        passwordHash: password,
        role: "student",
      },
      {
        id: IDS.uOrphanEnt,
        fullName: "Fixture Orphan Entitlement",
        email: "fixture.orphan@lexify.local",
        passwordHash: password,
        role: "student",
      },
      {
        id: IDS.uT1Live,
        fullName: "Fixture T1 Live",
        email: "fixture.t1@lexify.local",
        passwordHash: password,
        role: "student",
      },
      {
        id: IDS.uNoPay,
        fullName: "Fixture Sub No Payment",
        email: "fixture.nopay@lexify.local",
        passwordHash: password,
        role: "student",
      },
    ],
  });

  await prisma.faculty.create({
    data: {
      id: IDS.f1,
      nameUz: "Fixture fakultet",
      nameRu: "Fixture",
      nameEn: "Fixture",
      order: 99,
    },
  });

  await prisma.subject.createMany({
    data: [
      {
        id: IDS.s1,
        facultyId: IDS.f1,
        nameUz: "Fixture fan 1",
        nameRu: "F1",
        nameEn: "S1",
      },
      {
        id: IDS.s2,
        facultyId: IDS.f1,
        nameUz: "Fixture fan 2",
        nameRu: "F2",
        nameEn: "S2",
      },
    ],
  });

  await prisma.teacher.create({
    data: {
      id: IDS.t1,
      userId: IDS.uTeacher,
      facultyId: IDS.f1,
      subjectId: IDS.s1,
      fullName: "Fixture Teacher",
      contactEmail: "fixture.teacher@lexify.local",
    },
  });

  await prisma.course.createMany({
    data: [
      {
        id: IDS.c1,
        teacherId: IDS.t1,
        facultyId: IDS.f1,
        subjectId: IDS.s1,
        titleUz: "Fixture Course A",
        descriptionUz: "Active + multi mapping",
        priceT1: 150000,
        priceT2: 250000,
        priceT3: 400000,
        isPublished: true,
      },
      {
        id: IDS.c2,
        teacherId: IDS.t1,
        facultyId: IDS.f1,
        subjectId: IDS.s2,
        titleUz: "Fixture Course B",
        descriptionUz: "Second course for multi-course",
        priceT1: 180000,
        priceT2: 280000,
        priceT3: 450000,
        isPublished: true,
      },
      {
        id: IDS.c3,
        teacherId: IDS.t1,
        facultyId: IDS.f1,
        subjectId: IDS.s1,
        titleUz: "Fixture Course C",
        descriptionUz: "Unused course for wrong-course deny tests",
        priceT1: 100000,
        priceT2: 200000,
        priceT3: 300000,
        isPublished: true,
      },
    ],
  });

  await prisma.lesson.createMany({
    data: [
      {
        id: IDS.l1,
        courseId: IDS.c1,
        titleUz: "Fixture ended lesson",
        scheduledAt: addDays(now, -3),
        status: "ended",
        muxVodPlaybackId: "fixture_vod",
      },
      {
        id: IDS.l2,
        courseId: IDS.c1,
        titleUz: "Fixture live lesson",
        scheduledAt: now,
        status: "live",
      },
    ],
  });

  // A: one active course + payment
  await prisma.subscription.create({
    data: {
      userId: IDS.uActiveOne,
      courseId: IDS.c1,
      tier: "t2",
      startsAt: addDays(now, -5),
      endsAt: addDays(now, 25),
    },
  });
  await prisma.payment.create({
    data: {
      userId: IDS.uActiveOne,
      courseId: IDS.c1,
      tier: "t2",
      amount: 250000,
      status: "demo_paid",
      provider: "demo",
    },
  });
  await prisma.entitlement.create({
    data: {
      userId: IDS.uActiveOne,
      tier: "t2",
      startsAt: addDays(now, -5),
      endsAt: addDays(now, 25),
    },
  });

  // B/C: multi-course — two active subscriptions (target must keep both)
  await prisma.subscription.createMany({
    data: [
      {
        userId: IDS.uMulti,
        courseId: IDS.c1,
        tier: "t2",
        startsAt: addDays(now, -10),
        endsAt: addDays(now, 20),
      },
      {
        userId: IDS.uMulti,
        courseId: IDS.c2,
        tier: "t3",
        startsAt: addDays(now, -2),
        endsAt: addDays(now, 28),
      },
    ],
  });
  await prisma.payment.createMany({
    data: [
      {
        userId: IDS.uMulti,
        courseId: IDS.c1,
        tier: "t2",
        amount: 250000,
        status: "demo_paid",
        provider: "demo",
      },
      {
        userId: IDS.uMulti,
        courseId: IDS.c2,
        tier: "t3",
        amount: 400000,
        status: "demo_paid",
        provider: "demo",
      },
    ],
  });

  // E: expired legacy subscription (mapping still proposes accessOpen=true)
  await prisma.subscription.create({
    data: {
      userId: IDS.uExpired,
      courseId: IDS.c1,
      tier: "t1",
      startsAt: addDays(now, -60),
      endsAt: addDays(now, -1),
    },
  });
  await prisma.payment.create({
    data: {
      userId: IDS.uExpired,
      courseId: IDS.c1,
      tier: "t1",
      amount: 150000,
      status: "demo_paid",
      provider: "demo",
    },
  });

  // Entitlement orphan — must NOT auto-enroll
  await prisma.entitlement.create({
    data: {
      userId: IDS.uOrphanEnt,
      tier: "t2",
      startsAt: now,
      endsAt: addDays(now, 30),
    },
  });

  // T1 active (live_locked under OLD for live lessons)
  await prisma.subscription.create({
    data: {
      userId: IDS.uT1Live,
      courseId: IDS.c1,
      tier: "t1",
      startsAt: now,
      endsAt: addDays(now, 30),
    },
  });
  await prisma.payment.create({
    data: {
      userId: IDS.uT1Live,
      courseId: IDS.c1,
      tier: "t1",
      amount: 150000,
      status: "demo_paid",
      provider: "demo",
    },
  });

  // Subscription without Payment (zero-amount legacy purchase on apply)
  await prisma.subscription.create({
    data: {
      userId: IDS.uNoPay,
      courseId: IDS.c2,
      tier: "t2",
      startsAt: now,
      endsAt: addDays(now, 30),
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        note: "Local fixture loaded (legacy only). No Purchase/Enrollment created.",
        scenarios: {
          activeOneCourse: IDS.uActiveOne,
          multiCourse: IDS.uMulti,
          expired: IDS.uExpired,
          entitlementOrphan: IDS.uOrphanEnt,
          t1Live: IDS.uT1Live,
          subWithoutPayment: IDS.uNoPay,
          courses: [IDS.c1, IDS.c2, IDS.c3],
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
