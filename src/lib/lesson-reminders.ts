import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";

const WINDOW_MS = 15 * 60 * 1000;

/**
 * Talaba kabinet ochganda: 15 daqiqa ichida boshlanadigan darslar uchun
 * `lesson_starting` bildirishnoma (bir darsga kuniga bir marta).
 */
export async function maybeSendLessonReminders(userId: string) {
  const now = new Date();
  const until = new Date(now.getTime() + WINDOW_MS);

  const lessons = await prisma.lesson.findMany({
    where: {
      status: "scheduled",
      scheduledAt: { gte: now, lte: until },
      course: {
        subscriptions: {
          some: { userId, endsAt: { gt: now } },
        },
      },
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

/** Cron / batch: barcha faol obunalarga yaqinlashayotgan darslar. */
export async function sendUpcomingLessonReminders() {
  const now = new Date();
  const until = new Date(now.getTime() + WINDOW_MS);

  const lessons = await prisma.lesson.findMany({
    where: {
      status: "scheduled",
      scheduledAt: { gte: now, lte: until },
    },
    include: {
      course: {
        select: {
          titleUz: true,
          subscriptions: {
            where: { endsAt: { gt: now } },
            select: {
              userId: true,
              user: { select: { email: true, telegramChatId: true } },
            },
          },
        },
      },
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
    for (const sub of lesson.course.subscriptions) {
      const existing = await prisma.notification.findFirst({
        where: {
          userId: sub.userId,
          type: "lesson_starting",
          relatedId: lesson.id,
          createdAt: { gte: dayAgo },
        },
        select: { id: true },
      });
      if (existing) continue;

      await notifyUser({
        userId: sub.userId,
        type: "lesson_starting",
        titleUz: `Dars ${mins} daqiqadan keyin`,
        messageUz: `${lesson.course.titleUz}: ${lesson.titleUz}`,
        relatedId: lesson.id,
        email: sub.user.email,
        telegramChatId: sub.user.telegramChatId,
      });
      created += 1;
    }
  }

  return created;
}
