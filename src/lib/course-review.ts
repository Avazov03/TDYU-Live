import type { CourseLifecycleStatus, CourseReviewDecision } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import { isAdminRole } from "@/lib/roles";
import {
  checkCourseReviewAction,
  lifecycleLabel,
  type CourseReviewAction,
  type CourseReviewActor,
} from "@/lib/course-review-policy";

export type CourseReviewResult =
  | { ok: true; from: CourseLifecycleStatus; to: CourseLifecycleStatus }
  | {
      ok: false;
      status: 400 | 403 | 404 | 409;
      code: "NOT_FOUND" | "FORBIDDEN" | "INVALID_TRANSITION" | "VALIDATION" | "CONFLICT";
      message: string;
    };

const EVENT_DECISION: Partial<Record<CourseReviewAction, CourseReviewDecision>> = {
  submit: "submitted",
  request_changes: "changes_requested",
  reject: "rejected",
  approve: "approve_publish",
};

export async function applyCourseReviewAction(input: {
  courseId: string;
  actorUserId: string;
  actorRole: string | undefined;
  action: CourseReviewAction;
  reason?: string | null;
  listPrice?: number | null;
}): Promise<CourseReviewResult> {
  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
    select: {
      id: true,
      titleUz: true,
      descriptionUz: true,
      lifecycleStatus: true,
      listPrice: true,
      teacher: { select: { userId: true } },
      lessons: {
        where: { status: { not: "cancelled" } },
        select: { scheduledAt: true, status: true },
      },
    },
  });
  if (!course) return { ok: false, status: 404, code: "NOT_FOUND", message: "Kurs topilmadi" };

  const actor: CourseReviewActor | null = isAdminRole(input.actorRole)
    ? "admin"
    : course.teacher.userId && course.teacher.userId === input.actorUserId
      ? "owner_teacher"
      : null;

  const now = Date.now();
  const check = checkCourseReviewAction({
    action: input.action,
    actor,
    current: course.lifecycleStatus,
    reason: input.reason,
    listPrice: input.listPrice,
    course: {
      titleUz: course.titleUz,
      descriptionUz: course.descriptionUz,
      lessonCount: course.lessons.length,
    },
    hasFutureLesson: course.lessons.some(
      (l) => l.status === "scheduled" && l.scheduledAt.getTime() > now,
    ),
  });
  if (!check.ok) {
    const status = check.code === "FORBIDDEN" ? 403 : check.code === "VALIDATION" ? 400 : 409;
    return { ok: false, status, code: check.code, message: check.message };
  }

  const from = course.lifecycleStatus as CourseLifecycleStatus;
  const to = check.to;
  const reason = input.reason?.trim() || null;
  const listPrice = input.action === "approve" ? (input.listPrice as number) : null;

  const applied = await prisma.$transaction(async (tx) => {
    const updated = await tx.course.updateMany({
      where: { id: course.id, lifecycleStatus: from },
      data: {
        lifecycleStatus: to,
        ...(input.action === "approve"
          ? { listPrice, approvedByUserId: input.actorUserId }
          : {}),
        ...(input.action === "publish"
          ? { isPublished: true, publishedByUserId: input.actorUserId }
          : {}),
      },
    });
    if (updated.count !== 1) return false;

    const decision = EVENT_DECISION[input.action];
    if (decision) {
      await tx.courseReviewEvent.create({
        data: {
          courseId: course.id,
          actorId: input.actorUserId,
          decision,
          reason,
          priceSet: listPrice,
        },
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: input.actorUserId,
        action: `course.${input.action}`,
        entityType: "Course",
        entityId: course.id,
        metadata: JSON.stringify({ from, to, reason, listPrice }),
      },
    });
    return true;
  });
  if (!applied) {
    return {
      ok: false,
      status: 409,
      code: "CONFLICT",
      message: "Kurs holati hozirgina o‘zgardi — sahifani yangilang",
    };
  }

  await notifyForAction({
    action: input.action,
    courseId: course.id,
    title: course.titleUz,
    teacherUserId: course.teacher.userId,
    reason,
    to,
  }).catch(() => undefined);

  return { ok: true, from, to };
}

async function notifyForAction(input: {
  action: CourseReviewAction;
  courseId: string;
  title: string;
  teacherUserId: string | null;
  reason: string | null;
  to: CourseLifecycleStatus;
}) {
  if (input.action === "submit") {
    const admins = await prisma.user.findMany({ where: { role: "admin" }, select: { id: true } });
    for (const admin of admins) {
      await notifyUser({
        userId: admin.id,
        type: "system",
        titleUz: "Kurs tekshiruvga yuborildi",
        messageUz: input.title,
        relatedId: input.courseId,
      });
    }
    return;
  }
  if (!input.teacherUserId || input.action === "start_review") return;

  const messages: Partial<Record<CourseReviewAction, string>> = {
    request_changes: `O‘zgartirish so‘raldi: ${input.reason ?? ""}`,
    reject: `Rad etildi: ${input.reason ?? ""}`,
    approve: "Kurs tasdiqlandi. Nashr etilishi kutilmoqda.",
    publish: `Kurs nashr etildi (${lifecycleLabel(input.to)}).`,
  };
  await notifyUser({
    userId: input.teacherUserId,
    type: input.action === "publish" ? "course_published" : "system",
    titleUz: input.title,
    messageUz: messages[input.action] ?? "",
    relatedId: input.courseId,
  });
}

/** Latest admin decision reason for teacher display. */
export async function getLatestReviewReason(courseId: string): Promise<string | null> {
  const ev = await prisma.courseReviewEvent.findFirst({
    where: { courseId, decision: { in: ["changes_requested", "rejected"] } },
    orderBy: { createdAt: "desc" },
    select: { reason: true },
  });
  return ev?.reason ?? null;
}
