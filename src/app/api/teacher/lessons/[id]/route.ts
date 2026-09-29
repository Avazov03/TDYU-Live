import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTeacherForUser } from "@/lib/teacher";
import { formatDateTime, parseClientDateTime } from "@/lib/utils";
import { isCourseReviewV1Enabled, isScheduleRulesV1Enabled } from "@/lib/feature-flags";
import { isPreAudienceLifecycle, lessonPlanLock } from "@/lib/course-review-policy";
import { checkLessonRemoval, checkReschedule, lessonEnd } from "@/lib/schedule-policy";
import { loadTeacherLessonWindows } from "@/lib/schedule-guard";
import { notifyCourseStudents } from "@/lib/notify";
import { writeAuditLog } from "@/lib/audit-log";

const patchSchema = z.object({
  titleUz: z.string().trim().min(2).optional(),
  summaryUz: z.string().trim().max(500).optional().or(z.literal("")),
  coverUrl: z.string().trim().url().optional().or(z.literal("")),
  scheduledAt: z.string().optional(),
});

async function ownedLesson(userId: string, lessonId: string) {
  const teacher = await getTeacherForUser(userId);
  if (!teacher) return null;
  return prisma.lesson.findFirst({
    where: { id: lessonId, course: { teacherId: teacher.id } },
    include: { course: { select: { teacherId: true, titleUz: true, lifecycleStatus: true } } },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }

  const { id } = await params;
  const lesson = await ownedLesson(session.user.id, id);
  if (!lesson) return NextResponse.json({ error: "Dars topilmadi" }, { status: 404 });
  if (lesson.status === "live" || lesson.status === "lobby") {
    return NextResponse.json({ error: "Kutish/jonli efirda tahrirlab bo'lmaydi" }, { status: 400 });
  }
  const reviewFlow = isCourseReviewV1Enabled();
  const planLock = lessonPlanLock(lesson.course.lifecycleStatus, reviewFlow);
  if (planLock) {
    return NextResponse.json({ error: planLock, code: "PLAN_LOCKED" }, { status: 409 });
  }

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Noto'g'ri ma'lumot" }, { status: 400 });
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "O'zgarish yo'q" }, { status: 400 });
  }

  if (parsed.data.scheduledAt && lesson.status !== "scheduled") {
    return NextResponse.json({ error: "Faqat rejadagi dars vaqtini o'zgartirish mumkin" }, { status: 400 });
  }
  const nextAt = parsed.data.scheduledAt ? parseClientDateTime(parsed.data.scheduledAt) : null;
  if (nextAt && Number.isNaN(nextAt.getTime())) {
    return NextResponse.json({ error: "Vaqt noto‘g‘ri" }, { status: 400 });
  }
  const scheduleRules = isScheduleRulesV1Enabled();
  // datetime-local has minute precision; a title-only edit re-sends the same minute.
  const timeChanged = Boolean(
    nextAt && Math.abs(nextAt.getTime() - lesson.scheduledAt.getTime()) >= 60_000,
  );
  const nextEnd = nextAt
    ? new Date(nextAt.getTime() + (lessonEnd(lesson).getTime() - lesson.scheduledAt.getTime()))
    : null;
  if (scheduleRules && nextAt && nextEnd && timeChanged) {
    const check = checkReschedule({
      lessonId: lesson.id,
      currentStart: lesson.scheduledAt,
      currentEnd: lessonEnd(lesson),
      nextStart: nextAt,
      nextEnd,
      now: new Date(),
      others: await loadTeacherLessonWindows(lesson.course.teacherId),
      formatWhen: formatDateTime,
      noticeRequired: !isPreAudienceLifecycle(lesson.course.lifecycleStatus, reviewFlow),
    });
    if (!check.ok) {
      return NextResponse.json(
        { error: check.message, code: check.code },
        { status: check.code === "INVALID_TIME" ? 400 : 409 },
      );
    }
  }

  const updated = await prisma.lesson.update({
    where: { id: lesson.id },
    data: {
      ...(parsed.data.titleUz != null ? { titleUz: parsed.data.titleUz } : {}),
      ...(parsed.data.summaryUz !== undefined ? { summaryUz: parsed.data.summaryUz || null } : {}),
      ...(parsed.data.coverUrl !== undefined ? { coverUrl: parsed.data.coverUrl || null } : {}),
      ...(nextAt && timeChanged
        ? { scheduledAt: nextAt, ...(lesson.scheduledEndAt && nextEnd ? { scheduledEndAt: nextEnd } : {}) }
        : {}),
    },
  });

  if (scheduleRules && nextAt && timeChanged) {
    await writeAuditLog({
      actorId: session.user.id,
      action: "lesson.rescheduled",
      entityType: "Lesson",
      entityId: lesson.id,
      metadata: { from: lesson.scheduledAt.toISOString(), to: nextAt.toISOString() },
    });
    await notifyCourseStudents(lesson.courseId, {
      type: "system",
      titleUz: "Dars vaqti o‘zgardi",
      messageUz: `${lesson.course.titleUz}: «${updated.titleUz}» — ${formatDateTime(lesson.scheduledAt)} o‘rniga ${formatDateTime(nextAt)}.`,
      relatedId: lesson.id,
    }).catch(() => undefined);
  }

  return NextResponse.json({ lesson: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }

  const { id } = await params;
  const lesson = await ownedLesson(session.user.id, id);
  if (!lesson) return NextResponse.json({ error: "Dars topilmadi" }, { status: 404 });
  if (lesson.status !== "scheduled") {
    return NextResponse.json({ error: "Faqat rejadagi darsni o'chirish mumkin" }, { status: 400 });
  }
  const reviewFlow = isCourseReviewV1Enabled();
  const planLock = lessonPlanLock(lesson.course.lifecycleStatus, reviewFlow);
  if (planLock) {
    return NextResponse.json({ error: planLock, code: "PLAN_LOCKED" }, { status: 409 });
  }
  if (isScheduleRulesV1Enabled() && !isPreAudienceLifecycle(lesson.course.lifecycleStatus, reviewFlow)) {
    const check = checkLessonRemoval({
      currentStart: lesson.scheduledAt,
      currentEnd: lessonEnd(lesson),
      now: new Date(),
    });
    if (!check.ok) {
      return NextResponse.json({ error: check.message, code: check.code }, { status: 409 });
    }
  }

  await prisma.lesson.delete({ where: { id: lesson.id } });
  return NextResponse.json({ ok: true });
}
