import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTeacherForUser } from "@/lib/teacher";
import { notifyCourseStudents, notifyTeacherOfCourse } from "@/lib/notify";
import { formatDateTime, parseClientDateTime } from "@/lib/utils";
import {
  isCourseCompletionV1Enabled,
  isCourseReviewV1Enabled,
  isScheduleRulesV1Enabled,
} from "@/lib/feature-flags";
import { lessonPlanLock } from "@/lib/course-review-policy";
import { checkNewLessonTime, lessonEnd } from "@/lib/schedule-policy";
import { loadTeacherLessonWindows } from "@/lib/schedule-guard";

const schema = z.object({
  courseId: z.string().trim().min(1),
  titleUz: z.string().trim().min(2),
  summaryUz: z.string().trim().max(500).optional().or(z.literal("")),
  coverUrl: z.string().trim().url().optional().or(z.literal("")),
  scheduledAt: z.string(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }
  const teacher = await getTeacherForUser(session.user.id);
  if (!teacher) return NextResponse.json({ error: "Profil yo'q" }, { status: 404 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Noto'g'ri ma'lumot" }, { status: 400 });

  const course = await prisma.course.findFirst({
    where: { id: parsed.data.courseId, teacherId: teacher.id },
  });
  if (!course) return NextResponse.json({ error: "Kurs topilmadi" }, { status: 404 });
  if (isCourseCompletionV1Enabled() && course.lifecycleStatus === "completed") {
    return NextResponse.json(
      { error: "Kurs yakunlangan — yangi dars qo‘shib bo‘lmaydi", code: "COURSE_COMPLETED" },
      { status: 409 },
    );
  }
  const planLock = lessonPlanLock(course.lifecycleStatus, isCourseReviewV1Enabled());
  if (planLock) {
    return NextResponse.json({ error: planLock, code: "PLAN_LOCKED" }, { status: 409 });
  }

  const when = parseClientDateTime(parsed.data.scheduledAt);
  if (Number.isNaN(when.getTime())) {
    return NextResponse.json({ error: "Vaqt noto‘g‘ri" }, { status: 400 });
  }
  if (isScheduleRulesV1Enabled()) {
    const check = checkNewLessonTime({
      start: when,
      end: lessonEnd({ scheduledAt: when }),
      now: new Date(),
      others: await loadTeacherLessonWindows(teacher.id),
      formatWhen: formatDateTime,
    });
    if (!check.ok) {
      return NextResponse.json(
        { error: check.message, code: check.code },
        { status: check.code === "CONFLICT" ? 409 : 400 },
      );
    }
  }
  const lesson = await prisma.lesson.create({
    data: {
      courseId: course.id,
      titleUz: parsed.data.titleUz,
      summaryUz: parsed.data.summaryUz || null,
      coverUrl: parsed.data.coverUrl || null,
      scheduledAt: when,
    },
  });

  await notifyCourseStudents(course.id, {
    type: "system",
    titleUz: "Yangi dars rejasiga qo‘shildi",
    messageUz: `${course.titleUz}: ${lesson.titleUz}`,
    relatedId: lesson.id,
  }).catch(() => undefined);

  await notifyTeacherOfCourse(course.id, {
    type: "system",
    titleUz: "Dars saqlandi",
    messageUz: `${lesson.titleUz} — ${formatDateTime(when)}`,
    relatedId: lesson.id,
  }).catch(() => undefined);

  return NextResponse.json({ lesson }, { status: 201 });
}
