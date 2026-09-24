/**
 * Local/staging E2E fixture seed — mirrors prisma/seed.ts users/courses
 * WITHOUT touching Entitlement (table missing from applied migrations; tracked as app gap).
 *
 * Safety:
 * - Refuses NODE_ENV=production
 * - Does not run against production hosts
 * - Not a substitute for fixing the entitlements migration
 */
import "dotenv/config";
import { createSeedClient } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/password";
import { addDays } from "../src/lib/tariffs";

const prisma = createSeedClient();

const IDS = {
  f1: "11111111-1111-1111-1111-111111111101",
  s1: "22222222-2222-2222-2222-222222222201",
  t1: "33333333-3333-3333-3333-333333333301",
  c1: "44444444-4444-4444-4444-444444444401",
  c2: "44444444-4444-4444-4444-444444444402",
  l1: "55555555-5555-5555-5555-555555555501",
  l2: "55555555-5555-5555-5555-555555555502",
  uAdmin: "66666666-6666-6666-6666-666666666601",
  uTeacher: "66666666-6666-6666-6666-666666666602",
  uStudent: "66666666-6666-6666-6666-666666666603",
};

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("XATO: e2e seed production muhitida taqiqlangan.");
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL ?? "";
  if (/lexify\.zonic\.fit|open\.okina\.uz/i.test(dbUrl)) {
    console.error("XATO: e2e seed production DB ga ishlamaydi.");
    process.exit(1);
  }

  // Best-effort cleanup of E2E fixture rows (order matters for FKs).
  // Does NOT add missing schema columns (last_login_at, entitlements, recording_url) —
  // those belong to a dedicated migration phase. Role smokes stay gated by E2E_DB_READY.
  await prisma.attendance.deleteMany({ where: { userId: IDS.uStudent } });
  await prisma.payment.deleteMany({
    where: { userId: { in: [IDS.uStudent, IDS.uTeacher, IDS.uAdmin] } },
  });
  await prisma.subscription.deleteMany({ where: { userId: IDS.uStudent } });
  await prisma.lesson.deleteMany({ where: { id: { in: [IDS.l1, IDS.l2] } } });
  await prisma.course.deleteMany({ where: { id: { in: [IDS.c1, IDS.c2] } } });
  await prisma.teacher.deleteMany({ where: { id: IDS.t1 } });
  await prisma.subject.deleteMany({ where: { id: IDS.s1 } });
  await prisma.faculty.deleteMany({ where: { id: IDS.f1 } });
  await prisma.user.deleteMany({
    where: { id: { in: [IDS.uAdmin, IDS.uTeacher, IDS.uStudent] } },
  });

  const password = await hashPassword("demo1234");

  await prisma.user.createMany({
    data: [
      {
        id: IDS.uAdmin,
        fullName: "Madina Yoldosheva",
        email: "madina.y@gmail.com",
        passwordHash: password,
        role: "admin",
      },
      {
        id: IDS.uTeacher,
        fullName: "Karimov Aziz",
        email: "karimov@tdyu.live",
        passwordHash: password,
        role: "teacher",
      },
      {
        id: IDS.uStudent,
        fullName: "Bekzod Nazarov",
        email: "bekzod.n@gmail.com",
        passwordHash: password,
        role: "student",
      },
    ],
  });

  await prisma.faculty.create({
    data: {
      id: IDS.f1,
      nameUz: "Yuridik fakultet",
      nameRu: "Юридический факультет",
      nameEn: "Law Faculty",
      order: 1,
    },
  });

  await prisma.subject.create({
    data: {
      id: IDS.s1,
      facultyId: IDS.f1,
      nameUz: "Fuqarolik huquqi",
      nameRu: "Гражданское право",
      nameEn: "Civil law",
    },
  });

  await prisma.teacher.create({
    data: {
      id: IDS.t1,
      userId: IDS.uTeacher,
      facultyId: IDS.f1,
      subjectId: IDS.s1,
      fullName: "Karimov Aziz",
      contactEmail: "karimov@tdyu.live",
    },
  });

  await prisma.course.createMany({
    data: [
      {
        id: IDS.c1,
        teacherId: IDS.t1,
        facultyId: IDS.f1,
        subjectId: IDS.s1,
        titleUz: "Fuqarolik huquqi: asoslar",
        descriptionUz: "E2E fixture course.",
        priceT1: 150000,
        priceT2: 250000,
        priceT3: 400000,
        isPublished: true,
      },
      {
        id: IDS.c2,
        teacherId: IDS.t1,
        facultyId: IDS.f1,
        subjectId: IDS.s1,
        titleUz: "Shartnoma huquqi amaliyoti",
        descriptionUz: "E2E fixture course 2.",
        priceT1: 180000,
        priceT2: 280000,
        priceT3: 450000,
        isPublished: true,
      },
    ],
  });

  const now = new Date();
  await prisma.lesson.createMany({
    data: [
      {
        id: IDS.l1,
        courseId: IDS.c1,
        titleUz: "Kirish: fuqarolik huquqi tizimi",
        scheduledAt: addDays(now, -2),
        status: "ended",
        muxVodPlaybackId: "demo_vod_intro",
        muxLivePlaybackId: "demo_vod_intro",
      },
      {
        id: IDS.l2,
        courseId: IDS.c1,
        titleUz: "Shartnoma turlari",
        scheduledAt: now,
        status: "scheduled",
      },
    ],
  });

  await prisma.subscription.create({
    data: {
      userId: IDS.uStudent,
      courseId: IDS.c1,
      tier: "t1",
      startsAt: now,
      endsAt: addDays(now, 30),
    },
  });

  console.log("E2E local seed OK (users/courses/lessons/subscription).");
  console.log("NOTE: skipped Entitlement — table not in applied migrations.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
