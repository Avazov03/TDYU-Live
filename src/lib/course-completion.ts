import { prisma } from "@/lib/prisma";
import { notifyCourseStudents } from "@/lib/notify";
import { isAdminRole } from "@/lib/roles";
import { checkCourseCompletion } from "@/lib/course-completion-policy";

export type CourseCompletionResult =
  | { ok: true; completedSeats: number }
  | {
      ok: false;
      status: 403 | 404 | 409;
      code: "NOT_FOUND" | "FORBIDDEN" | "INVALID_STATE" | "OPEN_LESSONS" | "CONFLICT";
      message: string;
    };

export async function completeCourse(input: {
  courseId: string;
  actorUserId: string;
  actorRole: string | undefined;
}): Promise<CourseCompletionResult> {
  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
    select: {
      id: true,
      titleUz: true,
      lifecycleStatus: true,
      teacher: { select: { userId: true } },
      lessons: { select: { status: true } },
    },
  });
  if (!course) return { ok: false, status: 404, code: "NOT_FOUND", message: "Kurs topilmadi" };

  const owner = course.teacher.userId != null && course.teacher.userId === input.actorUserId;
  if (!owner && !isAdminRole(input.actorRole)) {
    return { ok: false, status: 403, code: "FORBIDDEN", message: "Ruxsat yo'q" };
  }

  const check = checkCourseCompletion({
    lifecycleStatus: course.lifecycleStatus,
    lessonStatuses: course.lessons.map((l) => l.status),
  });
  if (!check.ok) return { ok: false, status: 409, code: check.code, message: check.message };

  const now = new Date();
  const completedSeats = await prisma.$transaction(async (tx) => {
    const updated = await tx.course.updateMany({
      where: { id: course.id, lifecycleStatus: "active" },
      data: { lifecycleStatus: "completed" },
    });
    if (updated.count !== 1) return null;
    const seats = await tx.enrollment.updateMany({
      where: { courseId: course.id, status: "active", accessOpen: true },
      data: { status: "completed", completedAt: now },
    });
    await tx.auditLog.create({
      data: {
        actorId: input.actorUserId,
        action: "course.complete",
        entityType: "Course",
        entityId: course.id,
        metadata: JSON.stringify({ from: "active", to: "completed", completedSeats: seats.count }),
      },
    });
    return seats.count;
  });
  if (completedSeats == null) {
    return {
      ok: false,
      status: 409,
      code: "CONFLICT",
      message: "Kurs holati hozirgina o‘zgardi — sahifani yangilang",
    };
  }

  await notifyCourseStudents(course.id, {
    type: "system",
    titleUz: "Kurs yakunlandi",
    messageUz: `«${course.titleUz}» kursi yakunlandi. Dars yozuvlari «Mening kurslarim» bo‘limida doimiy ochiq qoladi.`,
    relatedId: course.id,
  });

  return { ok: true, completedSeats };
}
