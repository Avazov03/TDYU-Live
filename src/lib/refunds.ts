import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import { isAdminRole } from "@/lib/roles";
import { formatSom } from "@/lib/tariffs";
import { isOpenLessonStatus } from "@/lib/course-completion-policy";
import {
  checkSpecialRefund,
  checkTeacherCancellation,
  courseProgressPercent,
  hasCourseStarted,
} from "@/lib/refund-policy";

type Failure<C extends string> = { ok: false; status: 400 | 403 | 404 | 409; code: C; message: string };

export type CourseCancellationResult =
  | { ok: true; refunds: number; closedSeats: number }
  | Failure<"NOT_FOUND" | "FORBIDDEN" | "INVALID_STATE" | "ALREADY_STARTED" | "VALIDATION" | "CONFLICT">;

/**
 * Teacher cancellation before start. Demo record only — no provider call:
 * Refund(course_cancel_100) per completed Purchase, Purchase → refunded, seats closed.
 */
export async function cancelCourseWithRefunds(input: {
  courseId: string;
  actorUserId: string;
  actorRole: string | undefined;
  reason: string;
}): Promise<CourseCancellationResult> {
  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
    select: {
      id: true,
      titleUz: true,
      lifecycleStatus: true,
      teacher: { select: { userId: true } },
      lessons: { select: { id: true, status: true } },
    },
  });
  if (!course) return { ok: false, status: 404, code: "NOT_FOUND", message: "Kurs topilmadi" };
  const owner = course.teacher.userId != null && course.teacher.userId === input.actorUserId;
  if (!owner && !isAdminRole(input.actorRole)) {
    return { ok: false, status: 403, code: "FORBIDDEN", message: "Ruxsat yo'q" };
  }
  const reason = input.reason.trim();
  const check = checkTeacherCancellation({
    lifecycleStatus: course.lifecycleStatus,
    lessonStatuses: course.lessons.map((l) => l.status),
    reason,
  });
  if (!check.ok) {
    return { ok: false, status: check.code === "VALIDATION" ? 400 : 409, code: check.code, message: check.message };
  }

  const from = course.lifecycleStatus!;
  const now = new Date();
  const outcome = await prisma.$transaction(async (tx) => {
    const updated = await tx.course.updateMany({
      where: { id: course.id, lifecycleStatus: from },
      data: { lifecycleStatus: "cancelled", isPublished: false },
    });
    if (updated.count !== 1) return null;

    await tx.lesson.updateMany({
      where: {
        courseId: course.id,
        id: { in: course.lessons.filter((l) => isOpenLessonStatus(l.status)).map((l) => l.id) },
      },
      data: { status: "cancelled" },
    });

    const purchases = await tx.purchase.findMany({
      where: { courseId: course.id, status: "completed" },
      select: { id: true, userId: true, amountPaid: true },
    });
    const refunded: { userId: string; amount: number; refundId: string }[] = [];
    for (const p of purchases) {
      const refund = await tx.refund.create({
        data: {
          purchaseId: p.id,
          requestedById: input.actorUserId,
          decidedById: input.actorUserId,
          type: "course_cancel_100",
          status: "refunded",
          amount: p.amountPaid,
          reason,
          progressPercent: 0,
          decidedAt: now,
          completedAt: now,
          idempotencyKey: `course_cancel:${p.id}`,
        },
      });
      await tx.purchase.update({ where: { id: p.id }, data: { status: "refunded" } });
      await tx.auditLog.create({
        data: {
          actorId: input.actorUserId,
          action: "refund.course_cancel_100",
          entityType: "Refund",
          entityId: refund.id,
          metadata: JSON.stringify({ purchaseId: p.id, courseId: course.id, amount: p.amountPaid }),
        },
      });
      refunded.push({ userId: p.userId, amount: p.amountPaid, refundId: refund.id });
    }

    const seats = await tx.enrollment.findMany({
      where: { courseId: course.id, accessOpen: true, status: { in: ["active", "completed"] } },
      select: { id: true, userId: true, purchaseId: true },
    });
    const refundedPurchaseIds = new Set(purchases.map((p) => p.id));
    for (const seat of seats) {
      await tx.enrollment.update({
        where: { id: seat.id },
        data: {
          status: seat.purchaseId && refundedPurchaseIds.has(seat.purchaseId) ? "refunded" : "cancelled",
          accessOpen: false,
          closedAt: now,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: input.actorUserId,
        action: "course.cancel",
        entityType: "Course",
        entityId: course.id,
        metadata: JSON.stringify({ from, to: "cancelled", reason, refunds: refunded.length, closedSeats: seats.length }),
      },
    });
    return { refunded, seatUserIds: seats.map((s) => s.userId) };
  });
  if (!outcome) {
    return { ok: false, status: 409, code: "CONFLICT", message: "Kurs holati hozirgina o‘zgardi — sahifani yangilang" };
  }

  const notified = new Set<string>();
  for (const r of outcome.refunded) {
    notified.add(r.userId);
    await notifyUser({
      userId: r.userId,
      type: "refund_completed",
      titleUz: "Kurs bekor qilindi — to‘lov qaytarildi",
      messageUz: `«${course.titleUz}» kursi o‘qituvchi tomonidan bekor qilindi: ${reason}. To‘lov to‘liq qaytarildi: ${formatSom(r.amount)}.`,
      relatedId: r.refundId,
    }).catch(() => undefined);
  }
  for (const userId of outcome.seatUserIds) {
    if (notified.has(userId)) continue;
    notified.add(userId);
    await notifyUser({
      userId,
      type: "course_cancelled",
      titleUz: "Kurs bekor qilindi",
      messageUz: `«${course.titleUz}» kursi o‘qituvchi tomonidan bekor qilindi: ${reason}.`,
      relatedId: course.id,
    }).catch(() => undefined);
  }

  return { ok: true, refunds: outcome.refunded.length, closedSeats: outcome.seatUserIds.length };
}

export type SpecialRefundResult =
  | { ok: true; refundId: string; amount: number; progressPercent: number }
  | Failure<"NOT_FOUND" | "FORBIDDEN" | "NOT_REFUNDABLE" | "NOT_STARTED" | "PROGRESS_TOO_HIGH" | "VALIDATION" | "CONFLICT">;

/** Admin/support exception after start: 50% while course progress < 50%, with a written reason. */
export async function issueSpecialRefund(input: {
  purchaseId: string;
  actorUserId: string;
  actorRole: string | undefined;
  reason: string;
}): Promise<SpecialRefundResult> {
  if (!isAdminRole(input.actorRole)) {
    return { ok: false, status: 403, code: "FORBIDDEN", message: "Ruxsat yo'q" };
  }
  const purchase = await prisma.purchase.findUnique({
    where: { id: input.purchaseId },
    select: {
      id: true,
      userId: true,
      status: true,
      amountPaid: true,
      course: {
        select: { id: true, titleUz: true, lifecycleStatus: true, lessons: { select: { status: true } } },
      },
    },
  });
  if (!purchase) return { ok: false, status: 404, code: "NOT_FOUND", message: "Xarid topilmadi" };

  const lessonStatuses = purchase.course.lessons.map((l) => l.status);
  const progressPercent = courseProgressPercent(lessonStatuses);
  const reason = input.reason.trim();
  const check = checkSpecialRefund({
    purchaseStatus: purchase.status,
    amountPaid: purchase.amountPaid,
    courseStarted: hasCourseStarted({ lifecycleStatus: purchase.course.lifecycleStatus, lessonStatuses }),
    progressPercent,
    reason,
  });
  if (!check.ok) {
    return { ok: false, status: check.code === "VALIDATION" ? 400 : 409, code: check.code, message: check.message };
  }

  const now = new Date();
  const refundId = await prisma.$transaction(async (tx) => {
    const updated = await tx.purchase.updateMany({
      where: { id: purchase.id, status: "completed" },
      data: { status: "partially_refunded" },
    });
    if (updated.count !== 1) return null;
    const refund = await tx.refund.create({
      data: {
        purchaseId: purchase.id,
        requestedById: input.actorUserId,
        decidedById: input.actorUserId,
        type: "half_50",
        status: "refunded",
        amount: check.amount,
        reason,
        progressPercent,
        decidedAt: now,
        completedAt: now,
        idempotencyKey: `half_50:${purchase.id}`,
      },
    });
    await tx.enrollment.updateMany({
      where: { purchaseId: purchase.id, accessOpen: true },
      data: { status: "refunded", accessOpen: false, closedAt: now },
    });
    await tx.auditLog.create({
      data: {
        actorId: input.actorUserId,
        action: "refund.half_50",
        entityType: "Refund",
        entityId: refund.id,
        metadata: JSON.stringify({
          purchaseId: purchase.id,
          courseId: purchase.course.id,
          amount: check.amount,
          progressPercent,
          reason,
        }),
      },
    });
    return refund.id;
  });
  if (!refundId) {
    return { ok: false, status: 409, code: "CONFLICT", message: "Xarid holati hozirgina o‘zgardi — sahifani yangilang" };
  }

  await notifyUser({
    userId: purchase.userId,
    type: "refund_completed",
    titleUz: "To‘lovning 50% qaytarildi",
    messageUz: `«${purchase.course.titleUz}»: ${formatSom(check.amount)} qaytarildi. Kursga kirish yopildi.`,
    relatedId: refundId,
  }).catch(() => undefined);

  return { ok: true, refundId, amount: check.amount, progressPercent };
}
