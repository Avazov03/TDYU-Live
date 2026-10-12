import type { Course, Lesson } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyCourseStudents } from "@/lib/notify";
import { canTeacherOpenWaiting, ensureWaitingLiveSession, isWaitingLessonStatus } from "@/lib/live-session";
import {
  isCourseReviewV1Enabled,
  isLiveWaitingRoomV2Enabled,
  isScheduleRulesV1Enabled,
} from "@/lib/feature-flags";
import { checkTeacherCanOpenNow } from "@/lib/schedule-guard";
import { isLiveAllowedForCourse, lifecycleLabel } from "@/lib/course-review-policy";

export type OpenLobbyResult = { status: number; body: Record<string, unknown> };

/** Kutish xonasini ochadi — yozuv/Mux hali yo‘q. LiveSession WAITING (Wave 1). */
export async function openLobby(teacherId: string, lesson: Lesson & { course: Course }): Promise<OpenLobbyResult> {
  if (lesson.status === "cancelled") {
    return { status: 400, body: { error: "Bekor qilingan darsni ochib bo‘lmaydi" } };
  }
  if (lesson.status === "ended") {
    return { status: 400, body: { error: "Tugagan darsni qayta ochib bo‘lmaydi" } };
  }
  if (isCourseReviewV1Enabled() && !isLiveAllowedForCourse(lesson.course.lifecycleStatus)) {
    return {
      status: 409,
      body: { error: `Kurs «${lifecycleLabel(lesson.course.lifecycleStatus)}» holatida — efir faqat nashr etilgan kursda` },
    };
  }

  if (isWaitingLessonStatus(lesson.status) || lesson.status === "live") {
    const liveSession = isLiveWaitingRoomV2Enabled() ? await ensureWaitingLiveSession(lesson.id) : null;
    return { status: 200, body: { lesson, liveSession } };
  }

  if (!canTeacherOpenWaiting(lesson.status) || lesson.status !== "scheduled") {
    return { status: 400, body: { error: "Bu dars kutishga ochilmaydi" } };
  }
  if (isScheduleRulesV1Enabled()) {
    const check = await checkTeacherCanOpenNow(teacherId, lesson);
    if (!check.ok) return { status: 409, body: { error: check.message, code: check.code } };
  }

  const claimed = await prisma.lesson.updateMany({
    where: { id: lesson.id, status: "scheduled" },
    data: { status: "lobby" },
  });
  if (claimed.count !== 1) {
    const current = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });
    if (!isWaitingLessonStatus(current.status) && current.status !== "live") {
      return { status: 409, body: { error: "Dars holati hozirgina o‘zgardi — sahifani yangilang" } };
    }
    return {
      status: 200,
      body: {
        lesson: current,
        liveSession: isLiveWaitingRoomV2Enabled() ? await ensureWaitingLiveSession(lesson.id) : null,
      },
    };
  }
  const updated = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });
  const liveSession = isLiveWaitingRoomV2Enabled() ? await ensureWaitingLiveSession(lesson.id) : null;

  const notified = await notifyCourseStudents(
    lesson.courseId,
    {
      type: "lesson_starting",
      titleUz: "Kutish xonasi ochildi",
      messageUz: `${lesson.course.titleUz}: ${lesson.titleUz}. Kirib kutishingiz mumkin — efir hali boshlanmagan.`,
      relatedId: lesson.id,
    },
    "t2",
  );

  return { status: 200, body: { lesson: updated, liveSession, notified } };
}
