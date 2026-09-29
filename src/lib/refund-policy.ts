import type { CourseLifecycleStatus, LessonStatus, PurchaseStatus } from "@/generated/prisma/client";
import { isOpenLessonStatus } from "@/lib/course-completion-policy";

export const REFUND_HALF_MAX_PROGRESS = 50;
export const REFUND_MIN_REASON = 10;

/** Share of planned (non-cancelled) lessons already taught. 0 when nothing is planned. */
export function courseProgressPercent(lessonStatuses: LessonStatus[]): number {
  const planned = lessonStatuses.filter((s) => s !== "cancelled");
  if (planned.length === 0) return 0;
  const taught = planned.filter((s) => !isOpenLessonStatus(s)).length;
  return Math.floor((taught / planned.length) * 100);
}

export function hasCourseStarted(input: {
  lifecycleStatus: CourseLifecycleStatus | null;
  lessonStatuses: LessonStatus[];
}): boolean {
  if (input.lifecycleStatus === "active" || input.lifecycleStatus === "completed") return true;
  return input.lessonStatuses.some((s) => s !== "cancelled" && !isOpenLessonStatus(s));
}

export type CancellationCheck =
  | { ok: true }
  | { ok: false; code: "INVALID_STATE" | "ALREADY_STARTED" | "VALIDATION"; message: string };

/** Teacher cancels a course before its first lesson — every buyer gets 100% back. */
export function checkTeacherCancellation(input: {
  lifecycleStatus: CourseLifecycleStatus | null;
  lessonStatuses: LessonStatus[];
  reason: string | null | undefined;
}): CancellationCheck {
  if (hasCourseStarted(input)) {
    return {
      ok: false,
      code: "ALREADY_STARTED",
      message: "Kurs boshlangan — endi bekor qilib bo‘lmaydi. Muammo bo‘lsa admin bilan bog‘laning",
    };
  }
  if (
    input.lifecycleStatus !== "approved" &&
    input.lifecycleStatus !== "published" &&
    input.lifecycleStatus !== "upcoming"
  ) {
    return {
      ok: false,
      code: "INVALID_STATE",
      message: "Faqat tasdiqlangan yoki nashr etilgan kursni bekor qilish mumkin",
    };
  }
  if ((input.reason?.trim().length ?? 0) < REFUND_MIN_REASON) {
    return {
      ok: false,
      code: "VALIDATION",
      message: `Sababni yozing (kamida ${REFUND_MIN_REASON} belgi) — o‘quvchilarga yuboriladi`,
    };
  }
  return { ok: true };
}

export type SpecialRefundCheck =
  | { ok: true; amount: number }
  | {
      ok: false;
      code: "NOT_REFUNDABLE" | "NOT_STARTED" | "PROGRESS_TOO_HIGH" | "VALIDATION";
      message: string;
    };

type SpecialRefundInput = {
  purchaseStatus: PurchaseStatus;
  amountPaid: number;
  courseStarted: boolean;
  progressPercent: number;
  /** Purchase created by the Subscription → Enrollment backfill (was a Tarif payment). */
  legacyBackfill?: boolean;
};

/** Support/admin exception after start: 50% only while progress < 50% and with a justification. */
export function checkSpecialRefund(
  input: SpecialRefundInput & { reason: string | null | undefined },
): SpecialRefundCheck {
  const eligible = checkSpecialRefundEligibility(input);
  if (!eligible.ok) return eligible;
  if ((input.reason?.trim().length ?? 0) < REFUND_MIN_REASON) {
    return {
      ok: false,
      code: "VALIDATION",
      message: `Asosni yozing (kamida ${REFUND_MIN_REASON} belgi)`,
    };
  }
  return eligible;
}

/** Same rule without the reason — for showing the admin whether the action is available. */
export function checkSpecialRefundEligibility(input: SpecialRefundInput): SpecialRefundCheck {
  if (input.legacyBackfill) {
    return {
      ok: false,
      code: "NOT_REFUNDABLE",
      message: "Eski tarif obunasidan ko‘chirilgan xarid — kurs qaytarish qoidasi qo‘llanmaydi",
    };
  }
  if (input.purchaseStatus !== "completed") {
    return { ok: false, code: "NOT_REFUNDABLE", message: "Bu xarid uchun qaytarish qilib bo‘lmaydi" };
  }
  if (!input.courseStarted) {
    return {
      ok: false,
      code: "NOT_STARTED",
      message: "Kurs hali boshlanmagan — to‘liq qaytarish faqat o‘qituvchi kursni bekor qilganda",
    };
  }
  if (input.progressPercent >= REFUND_HALF_MAX_PROGRESS) {
    return {
      ok: false,
      code: "PROGRESS_TOO_HIGH",
      message: `Kursning ${input.progressPercent}% o‘tilgan — 50% qaytarish faqat ${REFUND_HALF_MAX_PROGRESS}% dan kam bo‘lsa`,
    };
  }
  return { ok: true, amount: Math.floor(input.amountPaid / 2) };
}
