const TZ = "Asia/Tashkent";

/** Hours (Tashkent) in which the "course starts tomorrow" reminder may be sent — never at night. */
export const COURSE_START_REMINDER_HOURS = { from: 9, to: 22 } as const;

export type RelatedKind = "lesson" | "course" | null;

export function tashkentDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function tashkentHour(date: Date): number {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(date);
  return Number(h);
}

/** True when the course's first lesson is on the next Tashkent calendar day and it is daytime now. */
export function isCourseStartReminderDue(input: { firstLessonAt: Date; now: Date }): boolean {
  const tomorrow = tashkentDayKey(new Date(input.now.getTime() + 86_400_000));
  if (tashkentDayKey(input.firstLessonAt) !== tomorrow) return false;
  const hour = tashkentHour(input.now);
  return hour >= COURSE_START_REMINDER_HOURS.from && hour < COURSE_START_REMINDER_HOURS.to;
}

/** Where a notification opens. `system` rows carry either a lesson or a course id, resolved by the caller. */
export function notificationHref(type: string, relatedId: string | null, kind: RelatedKind): string | null {
  if (!relatedId) return null;
  if (type === "lesson_live" || type === "lesson_starting") return `/learn/${relatedId}`;
  if (type === "assignment") return "/assignments";
  if (type === "certificate") return `/certificates/${relatedId}`;
  if (type === "purchase_success" || type === "course_starts_tomorrow" || type === "course_published") {
    return `/courses/${relatedId}`;
  }
  if (type === "system") {
    if (kind === "lesson") return `/learn/${relatedId}`;
    if (kind === "course") return `/courses/${relatedId}`;
  }
  return null;
}
