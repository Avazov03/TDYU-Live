/**
 * Schedule rules (FF_SCHEDULE_RULES_V1) — pure, no DB.
 * Spec: change ≥24h before start, students notified, blocked on Teacher conflict,
 * early start allowed only without conflict.
 */

export const DEFAULT_LESSON_MINUTES = 90;
export const RESCHEDULE_MIN_HOURS = 24;
const HOUR_MS = 3_600_000;

export type LessonWindow = {
  id: string;
  titleUz: string;
  courseTitleUz: string;
  start: Date;
  end: Date;
  status: string;
};

export type ScheduleCheck =
  | { ok: true }
  | { ok: false; code: "INVALID_TIME" | "TOO_LATE" | "CONFLICT"; message: string; conflictId?: string };

export function lessonEnd(lesson: {
  scheduledAt: Date;
  scheduledEndAt?: Date | null;
  durationMinutes?: number | null;
}): Date {
  if (lesson.scheduledEndAt && lesson.scheduledEndAt > lesson.scheduledAt) return lesson.scheduledEndAt;
  const minutes = lesson.durationMinutes && lesson.durationMinutes > 0 ? lesson.durationMinutes : DEFAULT_LESSON_MINUTES;
  return new Date(lesson.scheduledAt.getTime() + minutes * 60_000);
}

const BLOCKING_STATUSES = new Set(["scheduled", "lobby", "live"]);

export function findScheduleConflict(
  candidate: { start: Date; end: Date; excludeId?: string },
  others: LessonWindow[],
): LessonWindow | null {
  for (const o of others) {
    if (o.id === candidate.excludeId || !BLOCKING_STATUSES.has(o.status)) continue;
    if (candidate.start < o.end && o.start < candidate.end) return o;
  }
  return null;
}

function conflictMessage(o: LessonWindow, formatWhen: (d: Date) => string): string {
  return `Vaqt boshqa darsingiz bilan to‘qnashadi: «${o.courseTitleUz}» — «${o.titleUz}», ${formatWhen(o.start)}.`;
}

export function checkNewLessonTime(input: {
  start: Date;
  end: Date;
  now: Date;
  others: LessonWindow[];
  formatWhen: (d: Date) => string;
}): ScheduleCheck {
  if (Number.isNaN(input.start.getTime())) {
    return { ok: false, code: "INVALID_TIME", message: "Vaqt noto‘g‘ri" };
  }
  if (input.start.getTime() <= input.now.getTime()) {
    return { ok: false, code: "INVALID_TIME", message: "O‘tgan vaqtga dars qo‘yib bo‘lmaydi" };
  }
  const hit = findScheduleConflict(input, input.others);
  if (hit) return { ok: false, code: "CONFLICT", message: conflictMessage(hit, input.formatWhen), conflictId: hit.id };
  return { ok: true };
}

export function checkReschedule(input: {
  lessonId: string;
  currentStart: Date;
  nextStart: Date;
  nextEnd: Date;
  now: Date;
  others: LessonWindow[];
  formatWhen: (d: Date) => string;
  /** false = course has no students yet (draft): only past-time and conflict rules apply. */
  noticeRequired?: boolean;
}): ScheduleCheck {
  if (Number.isNaN(input.nextStart.getTime())) {
    return { ok: false, code: "INVALID_TIME", message: "Vaqt noto‘g‘ri" };
  }
  if (input.noticeRequired === false) {
    if (input.nextStart.getTime() <= input.now.getTime()) {
      return { ok: false, code: "INVALID_TIME", message: "O‘tgan vaqtga dars qo‘yib bo‘lmaydi" };
    }
    const hit = findScheduleConflict(
      { start: input.nextStart, end: input.nextEnd, excludeId: input.lessonId },
      input.others,
    );
    if (hit) return { ok: false, code: "CONFLICT", message: conflictMessage(hit, input.formatWhen), conflictId: hit.id };
    return { ok: true };
  }
  const minMs = RESCHEDULE_MIN_HOURS * HOUR_MS;
  if (input.currentStart.getTime() - input.now.getTime() < minMs) {
    return {
      ok: false,
      code: "TOO_LATE",
      message: `Dars boshlanishiga ${RESCHEDULE_MIN_HOURS} soatdan kam qoldi — vaqtini o‘zgartirib bo‘lmaydi. O‘quvchilar eski vaqtga tayyorlanishgan.`,
    };
  }
  if (input.nextStart.getTime() - input.now.getTime() < minMs) {
    return {
      ok: false,
      code: "TOO_LATE",
      message: `Yangi vaqt kamida ${RESCHEDULE_MIN_HOURS} soatdan keyin bo‘lsin — o‘quvchilar oldindan xabar olishi kerak.`,
    };
  }
  const hit = findScheduleConflict(
    { start: input.nextStart, end: input.nextEnd, excludeId: input.lessonId },
    input.others,
  );
  if (hit) return { ok: false, code: "CONFLICT", message: conflictMessage(hit, input.formatWhen), conflictId: hit.id };
  return { ok: true };
}

/** Removing a scheduled lesson follows the same 24h notice rule. */
export function checkLessonRemoval(input: { currentStart: Date; now: Date }): ScheduleCheck {
  if (input.currentStart.getTime() - input.now.getTime() < RESCHEDULE_MIN_HOURS * HOUR_MS) {
    return {
      ok: false,
      code: "TOO_LATE",
      message: `Dars boshlanishiga ${RESCHEDULE_MIN_HOURS} soatdan kam qoldi — uni o‘chirib bo‘lmaydi.`,
    };
  }
  return { ok: true };
}

/** Opening the room/starting now: no other lesson of this Teacher may be running or overlap. */
export function checkEarlyStart(input: {
  lessonId: string;
  now: Date;
  durationEnd: Date;
  others: LessonWindow[];
  formatWhen: (d: Date) => string;
}): ScheduleCheck {
  const running = input.others.find(
    (o) => o.id !== input.lessonId && (o.status === "live" || o.status === "lobby"),
  );
  if (running) {
    return {
      ok: false,
      code: "CONFLICT",
      message: `Avval «${running.titleUz}» darsini yakunlang — bir vaqtda ikki efir bo‘lmaydi.`,
      conflictId: running.id,
    };
  }
  const hit = findScheduleConflict(
    { start: input.now, end: input.durationEnd, excludeId: input.lessonId },
    input.others.filter((o) => o.status === "scheduled" && o.start > input.now),
  );
  if (hit) return { ok: false, code: "CONFLICT", message: conflictMessage(hit, input.formatWhen), conflictId: hit.id };
  return { ok: true };
}
