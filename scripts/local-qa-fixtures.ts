/**
 * Local QA fixtures only. Refuses any non-localhost database.
 * Does not delete existing rows.
 */
import { config } from "dotenv";
import { hashPassword } from "../src/lib/password";
import { createSeedClient } from "../src/lib/prisma";

config({ path: ".env" });

const raw = process.env.DATABASE_URL || "";
const host = new URL(raw.replace(/^postgresql:/i, "http:").replace(/^postgres:/i, "http:")).hostname;
if (host !== "localhost" && host !== "127.0.0.1") {
  console.error("refused: not local");
  process.exit(1);
}
if (process.env.NODE_ENV === "production") {
  console.error("refused: production");
  process.exit(1);
}

const IDS = {
  admin: "c7777777-7777-4777-8777-777777777701",
  teacher2User: "c7777777-7777-4777-8777-777777777702",
  teacher2: "c7777777-7777-4777-8777-777777777703",
  draftCourse: "c7777777-7777-4777-8777-777777777704",
  draftLesson: "c7777777-7777-4777-8777-777777777705",
};

async function main() {
  const prisma = createSeedClient();
  const password = await hashPassword("demo1234");
  const teacher = await prisma.teacher.findFirst({
    where: { user: { email: "fixture.teacher@lexify.local" } },
  });
  if (!teacher) throw new Error("fixture teacher missing");

  await prisma.user.upsert({
    where: { email: "fixture.admin@lexify.local" },
    update: { role: "admin", passwordHash: password, accountStatus: "active", isBlocked: false },
    create: {
      id: IDS.admin,
      fullName: "Fixture Admin",
      email: "fixture.admin@lexify.local",
      passwordHash: password,
      role: "admin",
    },
  });

  await prisma.user.upsert({
    where: { email: "fixture.teacher2@lexify.local" },
    update: { role: "teacher", passwordHash: password, accountStatus: "active", isBlocked: false },
    create: {
      id: IDS.teacher2User,
      fullName: "Fixture Teacher Two",
      email: "fixture.teacher2@lexify.local",
      passwordHash: password,
      role: "teacher",
    },
  });
  const teacher2User = await prisma.user.findUniqueOrThrow({
    where: { email: "fixture.teacher2@lexify.local" },
  });
  await prisma.teacher.upsert({
    where: { userId: teacher2User.id },
    update: { subjectId: teacher.subjectId, facultyId: teacher.facultyId },
    create: {
      id: IDS.teacher2,
      userId: teacher2User.id,
      facultyId: teacher.facultyId,
      subjectId: teacher.subjectId,
      fullName: "Fixture Teacher Two",
      contactEmail: "fixture.teacher2@lexify.local",
    },
  });

  const starts = new Date(Date.now() + 26 * 60 * 60 * 1000);
  await prisma.course.upsert({
    where: { id: IDS.draftCourse },
    update: {},
    create: {
      id: IDS.draftCourse,
      teacherId: teacher.id,
      facultyId: teacher.facultyId,
      subjectId: teacher.subjectId,
      titleUz: "QA Draft Course",
      descriptionUz: "Admin tekshiruvi uchun qoralama kurs. Jonli huquq darsi.",
      priceT1: 100000,
      priceT2: 150000,
      priceT3: 200000,
      isPublished: false,
      lifecycleStatus: "draft",
      listPrice: null,
    },
  });
  await prisma.lesson.upsert({
    where: { id: IDS.draftLesson },
    update: {},
    create: {
      id: IDS.draftLesson,
      courseId: IDS.draftCourse,
      titleUz: "QA draft lesson",
      scheduledAt: starts,
      durationMinutes: 60,
      status: "scheduled",
    },
  });

  if (process.argv.includes("--fresh-course")) {
    const stamp = Date.now().toString(36);
    const course = await prisma.course.create({
      data: {
        teacherId: teacher.id,
        facultyId: teacher.facultyId,
        subjectId: teacher.subjectId,
        titleUz: `QA Run ${stamp}`,
        descriptionUz: "Real brauzer QA uchun yangi kurs. Jonli huquq darsi.",
        priceT1: 120000,
        priceT2: 120000,
        priceT3: 120000,
        listPrice: 120000,
        isPublished: true,
        lifecycleStatus: "upcoming",
      },
    });
    const lessonIds: string[] = [];
    for (const [i, title] of ["one", "two", "three"].entries()) {
      const lesson = await prisma.lesson.create({
        data: {
          courseId: course.id,
          titleUz: `QA run lesson ${title}`,
          scheduledAt: new Date(starts.getTime() + i * 24 * 60 * 60 * 1000),
          durationMinutes: 60,
          status: "scheduled",
        },
      });
      lessonIds.push(lesson.id);
    }
    console.log(`FRESH ${course.id} ${lessonIds.join(" ")} ${course.titleUz}`);
  }

  console.log("host", host);
  console.log("admin fixture.admin@lexify.local");
  console.log("teacher2 fixture.teacher2@lexify.local");
  console.log("draft", IDS.draftCourse);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
