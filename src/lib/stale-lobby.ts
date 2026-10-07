import { prisma } from "@/lib/prisma";
import { closeLiveRoom } from "@/lib/live-rooms";
import { endLiveSession } from "@/lib/live-session";
import { notifyCourseStudents, notifyTeacherOfCourse } from "@/lib/notify";
import { isLiveAttendanceV3Enabled, isLiveWaitingRoomV2Enabled } from "@/lib/feature-flags";
import { closeAllOpenAttendanceForLiveSession } from "@/lib/live-attendance";
import { autoEndLesson } from "@/lib/live-clock-service";

/** A waiting room that never went live this long after both its opening and the lesson time is closed. */
export const STALE_LOBBY_MINUTES = 60;
/** A live/paused lesson whose teacher sent no clock beat this long is treated as abandoned. */
export const ABANDONED_LIVE_MINUTES = 30;

export async function closeStaleLobbies(now = new Date()): Promise<number> {
  if (!isLiveWaitingRoomV2Enabled()) return 0;
  const cutoff = new Date(now.getTime() - STALE_LOBBY_MINUTES * 60_000);
  const lessons = await prisma.lesson.findMany({
    where: {
      status: { in: ["lobby", "waiting_room"] },
      scheduledAt: { lt: cutoff },
      liveSessions: { some: { status: { in: ["waiting", "created"] }, createdAt: { lt: cutoff } } },
    },
    include: { course: { select: { titleUz: true } } },
  });

  let closed = 0;
  for (const lesson of lessons) {
    // Claim before touching the session: a teacher pressing "start" meanwhile must keep a live session.
    const claimed = await prisma.lesson.updateMany({
      where: { id: lesson.id, status: lesson.status },
      data: { status: "scheduled" },
    });
    if (claimed.count !== 1) continue;
    closeLiveRoom(lesson.id);
    await endLiveSession(lesson.id);
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
      messageUz: `${lesson.titleUz}: dars vaqtidan keyin ${STALE_LOBBY_MINUTES} daqiqa ichida efir boshlanmadi. Talabalarga xabar berildi — darsni qayta ochishingiz mumkin.`,
      relatedId: lesson.id,
    }).catch(() => undefined);
  }
  return closed;
}

export async function closeAbandonedLive(now = new Date()): Promise<number> {
  if (!isLiveWaitingRoomV2Enabled()) return 0;
  const cutoff = new Date(now.getTime() - ABANDONED_LIVE_MINUTES * 60_000);
  const sessions = await prisma.liveSession.findMany({
    where: {
      status: { in: ["live", "paused"] },
      lesson: { status: { in: ["live", "paused"] } },
      OR: [
        { lastTeacherBeatAt: { lt: cutoff } },
        { lastTeacherBeatAt: null, sessionStartedAt: { lt: cutoff } },
        { lastTeacherBeatAt: null, sessionStartedAt: null, createdAt: { lt: cutoff } },
      ],
    },
    include: { lesson: { select: { id: true, titleUz: true, courseId: true, course: { select: { titleUz: true } } } } },
  });

  let ended = 0;
  for (const session of sessions) {
    const { lesson } = session;
    if (isLiveAttendanceV3Enabled()) await closeAllOpenAttendanceForLiveSession(session.id);
    const done = await autoEndLesson(lesson.id, session.id, {
      titleUz: "Dars yakunlandi",
      messageUz: `${lesson.course.titleUz}: ${lesson.titleUz} — o‘qituvchi efirga qaytmadi, dars yopildi. Yozuv bo‘lsa, tekshiruvdan keyin ochiladi.`,
    });
    if (!done) continue;
    ended++;
    await notifyTeacherOfCourse(lesson.courseId, {
      type: "system",
      titleUz: "Efir avtomatik yopildi",
      messageUz: `${lesson.titleUz}: ${ABANDONED_LIVE_MINUTES} daqiqa davomida studiyadan signal kelmadi, efir yopildi. Yozuv tekshiruvingizga tushadi.`,
      relatedId: lesson.id,
    }).catch(() => undefined);
  }
  return ended;
}
