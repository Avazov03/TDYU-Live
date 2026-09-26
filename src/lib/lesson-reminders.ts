import { prisma } from "@/lib/prisma";
import { courseStudentRecipients, notifyUser } from "@/lib/notify";
import { getStudentOwnedCourses } from "@/lib/access";

const WINDOW_MS = 15 * 60 * 1000;

/**
 * Talaba kabinet ochganda: 15 daqiqa ichida boshlanadigan darslar uchun
 * `lesson_starting` bildirishnoma (bir darsga kuniga bir marta).
 */
export async function maybeSendLessonReminders(userId: string) {
  const now = new Date();
  const until = new Date(now.getTime() + WINDOW_MS);

  const courseIds = (await getStudentOwnedCourses(userId)).map((row) => row.courseId);
  if (courseIds.length === 0) return 0;

  const lessons = await prisma.lesson.findMany({
    where: {
      status: "scheduled",
      scheduledAt: { gte: now, lte: until },
      courseId: { in: courseIds },
    },
    include: {
      course: { select: { titleUz: true } },
    },
    take: 5,
  });

  if (lessons.length === 0) return 0;

  let created = 0;
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  for (const lesson of lessons) {
    const existing = await prisma.notification.findFirst({
      where: {
        userId,
        type: "lesson_starting",
        relatedId: lesson.id,
        createdAt: { gte: dayAgo },
      },
      select: { id: true },
    });
    if (existing) continue;

    const mins = Math.max(
      1,
      Math.round((lesson.scheduledAt.getTime() - now.getTime()) / 60_000),
    );

    await notifyUser({
      userId,
      type: "lesson_starting",
      titleUz: `Dars ${mins} daqiqadan keyin`,
      messageUz: `${lesson.course.titleUz}: ${lesson.titleUz}`,
      relatedId: lesson.id,
    });
    created += 1;
  }

  return created;
}

/** Cron / batch: yaqinlashayotgan darslar — kursning barcha o‘quvchilariga (obuna yoki xarid). */
export async function sendUpcomingLessonReminders() {
  const now = new Date();
  const until = new Date(now.getTime() + WINDOW_MS);

  const lessons = await prisma.lesson.findMany({
    where: {
      status: "scheduled",
      scheduledAt: { gte: now, lte: until },
    },
    include: {
      course: { select: { titleUz: true } },
    },
    take: 40,
  });

  let created = 0;
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  for (const lesson of lessons) {
    const mins = Math.max(
      1,
      Math.round((lesson.scheduledAt.getTime() - now.getTime()) / 60_000),
    );
    for (const student of await courseStudentRecipients(lesson.courseId)) {
      const existing = await prisma.notification.findFirst({
        where: {
          userId: student.id,
          type: "lesson_starting",
          relatedId: lesson.id,
          createdAt: { gte: dayAgo },
        },
        select: { id: true },
      });
      if (existing) continue;

      await notifyUser({
        userId: student.id,
        type: "lesson_starting",
        titleUz: `Dars ${mins} daqiqadan keyin`,
        messageUz: `${lesson.course.titleUz}: ${lesson.titleUz}`,
        relatedId: lesson.id,
        email: student.email,
        telegramChatId: student.telegramChatId,
      });
      created += 1;
    }
  }

  return created;
}
