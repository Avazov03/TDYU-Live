import { prisma } from "@/lib/prisma";
import { closeLiveRoom } from "@/lib/live-rooms";
import { endLiveSession } from "@/lib/live-session";
import { notifyCourseStudents, notifyTeacherOfCourse } from "@/lib/notify";
import { isLiveWaitingRoomV2Enabled } from "@/lib/feature-flags";

/** A waiting room that never went live within this window is closed by the reminders cron. */
export const STALE_LOBBY_MINUTES = 60;

export async function closeStaleLobbies(now = new Date()): Promise<number> {
  if (!isLiveWaitingRoomV2Enabled()) return 0;
  const cutoff = new Date(now.getTime() - STALE_LOBBY_MINUTES * 60_000);
  const lessons = await prisma.lesson.findMany({
    where: {
      status: { in: ["lobby", "waiting_room"] },
      liveSessions: { some: { status: { in: ["waiting", "created"] }, createdAt: { lt: cutoff } } },
    },
    include: { course: { select: { titleUz: true } } },
  });

  let closed = 0;
  for (const lesson of lessons) {
    closeLiveRoom(lesson.id);
    await endLiveSession(lesson.id);
    const claimed = await prisma.lesson.updateMany({
      where: { id: lesson.id, status: lesson.status },
      data: { status: "scheduled" },
    });
    if (claimed.count !== 1) continue;
    closed++;
    await notifyCourseStudents(lesson.courseId, {
      type: "system",
      titleUz: "Kutish xonasi yopildi",
      messageUz: `${lesson.course.titleUz}: ${lesson.titleUz} — efir boshlanmadi. O‘qituvchi yangi vaqtni e’lon qiladi.`,
      relatedId: lesson.id,
    }).catch(() => undefined);
    await notifyTeacherOfCourse(lesson.courseId, {
      type: "system",
      titleUz: "Kutish xonasi avtomatik yopildi",
      messageUz: `${lesson.titleUz}: ${STALE_LOBBY_MINUTES} daqiqa ichida efir boshlanmadi. Talabalarga xabar berildi — darsni qayta ochishingiz mumkin.`,
      relatedId: lesson.id,
    }).catch(() => undefined);
  }
  return closed;
}
