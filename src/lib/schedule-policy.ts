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

/** Student view: which listed lessons share time with another one → id → titles of the others. */
export function overlappingLessons(
  items: { id: string; title: string; start: Date; end: Date }[],
): Map<string, string[]> {
  const hits = new Map<string, string[]>();
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (a.start < b.end && b.start < a.end) {
        hits.set(a.id, [...(hits.get(a.id) ?? []), b.title]);
        hits.set(b.id, [...(hits.get(b.id) ?? []), a.title]);
      }
    }
  }
  return hits;
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
  currentEnd?: Date;
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
  if (!slotPassed(input.currentEnd, input.now) && input.currentStart.getTime() - input.now.getTime() < minMs) {
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

/** A never-started lesson whose slot is over: nobody is waiting for the old time any more. */
function slotPassed(currentEnd: Date | undefined, now: Date) {
  return Boolean(currentEnd && currentEnd.getTime() <= now.getTime());
}

/** Removing a scheduled lesson follows the same 24h notice rule. */
export function checkLessonRemoval(input: { currentStart: Date; now: Date; currentEnd?: Date }): ScheduleCheck {
  if (slotPassed(input.currentEnd, input.now)) return { ok: true };
  if (input.currentStart.getTime() - input.now.getTime() < RESCHEDULE_MIN_HOURS * HOUR_MS) {
    return {
      ok: false,
      code: "TOO_LATE",
      message: `Dars boshlanishiga ${RESCHEDULE_MIN_HOURS} soatdan kam qoldi — uni o‘chirib bo‘lmaydi.`,
    };
  }
  return { ok: true };
}

/** A room is open for this lesson: waiting, live or paused. A Teacher may have only one at a time. */
export const RUNNING_LESSON_STATUSES = ["lobby", "waiting_room", "live", "paused"] as const;

export function isRunningLessonStatus(status: string): boolean {
  return (RUNNING_LESSON_STATUSES as readonly string[]).includes(status);
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
    (o) => o.id !== input.lessonId && isRunningLessonStatus(o.status),
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
