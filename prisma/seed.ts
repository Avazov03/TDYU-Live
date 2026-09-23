import "dotenv/config";
import { createSeedClient } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/password";
import { addDays } from "../src/lib/tariffs";
import { createInviteToken, inviteExpiresAt } from "../src/lib/invite";

const prisma = createSeedClient();

const IDS = {
  f1: "11111111-1111-1111-1111-111111111101",
  s1: "22222222-2222-2222-2222-222222222201",
  s2: "22222222-2222-2222-2222-222222222202",
  t1: "33333333-3333-3333-3333-333333333301",
  t2: "33333333-3333-3333-3333-333333333302",
  c1: "44444444-4444-4444-4444-444444444401",
  c2: "44444444-4444-4444-4444-444444444402",
  l1: "55555555-5555-5555-5555-555555555501",
  l2: "55555555-5555-5555-5555-555555555502",
  l3: "55555555-5555-5555-5555-555555555503",
  uAdmin: "66666666-6666-6666-6666-666666666601",
  uTeacher: "66666666-6666-6666-6666-666666666602",
  uStudent: "66666666-6666-6666-6666-666666666603",
  a1: "77777777-7777-7777-7777-777777777701",
};

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("XATO: db:seed production muhitida taqiqlangan.");
    process.exit(1);
  }

  // Phase 1 target children first (safe if empty).
  await prisma.refund.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.attendanceInterval.deleteMany();
  await prisma.liveSession.deleteMany();
  await prisma.recording.deleteMany();
  await prisma.courseReviewEvent.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.securityEvent.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.certificate.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.entitlement.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.teacherInvite.deleteMany();
  await prisma.course.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.faculty.deleteMany();
  await prisma.user.deleteMany();
  await prisma.siteSetting.deleteMany();

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

  await prisma.subject.createMany({
    data: [
      {
        id: IDS.s1,
        facultyId: IDS.f1,
        nameUz: "Fuqarolik huquqi",
        nameRu: "Гражданское право",
        nameEn: "Civil law",
      },
      {
        id: IDS.s2,
        facultyId: IDS.f1,
        nameUz: "Jinoyat huquqi",
        nameRu: "Уголовное право",
        nameEn: "Criminal law",
      },
    ],
  });

  await prisma.teacher.createMany({
    data: [
      {
        id: IDS.t1,
        userId: IDS.uTeacher,
        facultyId: IDS.f1,
        subjectId: IDS.s1,
        fullName: "Karimov Aziz",
        contactEmail: "karimov@tdyu.live",
      },
      {
        id: IDS.t2,
        facultyId: IDS.f1,
        subjectId: IDS.s2,
        fullName: "Rasulova Dilnoza",
        contactEmail: "rasulova@tdyu.live",
      },
    ],
  });

  await prisma.teacherInvite.create({
    data: {
      teacherId: IDS.t2,
      token: createInviteToken(),
      expiresAt: inviteExpiresAt(),
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
        descriptionUz: "Shartnoma, mulk va majburiyatlar bo'yicha amaliy kurs. Jonli dars + yozuv.",
        priceT1: 150000,
        priceT2: 250000,
        priceT3: 400000,
      },
      {
        id: IDS.c2,
        teacherId: IDS.t1,
        facultyId: IDS.f1,
        subjectId: IDS.s1,
        titleUz: "Shartnoma huquqi amaliyoti",
        descriptionUz: "Shartnoma tuzish, nizolar va case-study darslari.",
        priceT1: 180000,
        priceT2: 280000,
        priceT3: 450000,
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
      {
        id: IDS.l3,
        courseId: IDS.c2,
        titleUz: "Amaliy case: oldi-sotdi",
        scheduledAt: addDays(now, 3),
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

  await prisma.payment.create({
    data: {
      userId: IDS.uStudent,
      courseId: IDS.c1,
      tier: "t1",
      amount: 150000,
      status: "demo_paid",
      provider: "demo",
    },
  });

  await prisma.assignment.create({
    data: {
      id: IDS.a1,
      courseId: IDS.c1,
      lessonId: IDS.l1,
      titleUz: "1-topshiriq: shartnoma tahlili",
      descriptionUz: "Qisqa matn yozing yoki PDF/rasm yuklang.",
      dueAt: addDays(now, 7),
    },
  });

  console.log("Seed muvaffaqiyatli yakunlandi.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
