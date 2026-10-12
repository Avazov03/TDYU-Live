import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTeacherForUser } from "@/lib/teacher";
import { ensureTeacherWorkspace } from "@/lib/teacher-workspace";
import { isCourseReviewV1Enabled, isScheduleRulesV1Enabled } from "@/lib/feature-flags";
import { isLiveAllowedForCourse } from "@/lib/course-review-policy";
import { RUNNING_LESSON_STATUSES, findScheduleConflict, lessonEnd } from "@/lib/schedule-policy";
import { loadTeacherLessonWindows } from "@/lib/schedule-guard";
import { QUICK_LESSON_TITLE, isQuickLesson } from "@/lib/quick-lesson";
import { openLobby } from "@/lib/open-lobby";

const QUICK_REUSE_MS = 30 * 60 * 1000;
const DOUBLE_SUBMIT_MS = 2 * 60 * 1000;

const bodySchema = z.object({
  courseId: z.string().trim().min(1).optional(),
  titleUz: z.string().trim().max(120).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }
  const teacher = await getTeacherForUser(session.user.id);
  if (!teacher) return NextResponse.json({ error: "Profil yo'q" }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Noto'g'ri ma'lumot" }, { status: 400 });
  const topic = parsed.data.titleUz ?? "";
  if (topic.length === 1) {
    return NextResponse.json({ error: "Mavzu kamida 2 ta harf bo‘lsin" }, { status: 400 });
  }
  if (parsed.data.courseId) return openQuickLobby(teacher.id, parsed.data.courseId, topic || QUICK_LESSON_TITLE);

  let courseId: string | null;
  if (isCourseReviewV1Enabled()) {
    const liveCourse = await prisma.course.findFirst({
      where: {
        teacherId: teacher.id,
        OR: [
          { lifecycleStatus: null },
          { lifecycleStatus: { in: ["published", "upcoming", "active"] } },
        ],
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!liveCourse) {
      return NextResponse.json(
        { error: "Nashr etilgan kurs yo‘q — avval kursni tekshiruvga yuboring" },
        { status: 409 },
      );
    }
    courseId = liveCourse.id;
  } else {
    courseId = await ensureTeacherWorkspace(teacher.id);
  }
  if (!courseId) return NextResponse.json({ error: "Kurs ochilmadi" }, { status: 500 });

  const live = await prisma.lesson.findFirst({
    where: { status: "live", course: { teacherId: teacher.id } },
  });
  if (live) return NextResponse.json({ lesson: live, alreadyLive: true });

  // Double click / second tab: reuse the quick lesson that has not started yet.
  // The per-teacher advisory lock makes parallel clicks see each other's insert.
  const targetCourseId = courseId;
  const { lesson, reused } = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`select pg_advisory_xact_lock(hashtext(${`quick-live:${teacher.id}`}))`;
    const pending = await tx.lesson.findFirst({
      where: {
        courseId: targetCourseId,
        titleUz: QUICK_LESSON_TITLE,
        status: { in: ["scheduled", "lobby", "waiting_room"] },
        createdAt: { gte: new Date(Date.now() - QUICK_REUSE_MS) },
      },
      orderBy: { createdAt: "desc" },
    });
    if (pending) return { lesson: pending, reused: true };
    const created = await tx.lesson.create({
      data: { courseId: targetCourseId, titleUz: QUICK_LESSON_TITLE, scheduledAt: new Date() },
    });
    return { lesson: created, reused: false };
  });
  return reused ? NextResponse.json({ lesson, reused: true }) : NextResponse.json({ lesson }, { status: 201 });
}

/**
 * Card «Hozir dars o‘tish»: the lesson is created together with its waiting room,
 * so backing out never leaves an unplanned lesson in the plan or the students' schedule.
 */
async function openQuickLobby(teacherId: string, courseId: string, titleUz: string) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, teacherId },
    select: { id: true, lifecycleStatus: true },
  });
  if (!course) return NextResponse.json({ error: "Kurs topilmadi" }, { status: 404 });
  if (isCourseReviewV1Enabled() && !isLiveAllowedForCourse(course.lifecycleStatus)) {
    return NextResponse.json(
      {
        error:
          course.lifecycleStatus === "completed"
            ? "Kurs yakunlangan — yangi dars o‘tib bo‘lmaydi"
            : "Bu kursda hali efir ochilmaydi — avval kurs nashr etilishi kerak",
      },
      { status: 409 },
    );
  }

  const running = await prisma.lesson.findFirst({
    where: { status: { in: [...RUNNING_LESSON_STATUSES] }, course: { teacherId } },
    include: { course: { select: { titleUz: true } } },
  });
  if (running && running.courseId === course.id) {
    return NextResponse.json({ lesson: running, alreadyLive: true });
  }
  if (running) {
    return NextResponse.json(
      {
        error: `Hozir «${running.course.titleUz}» kursida dars ochiq — avval uni yakunlang.`,
        code: "OTHER_LESSON_OPEN",
        lessonId: running.id,
      },
      { status: 409 },
    );
  }
  if (isScheduleRulesV1Enabled()) {
    const now = new Date();
    const hit = findScheduleConflict(
      { start: now, end: lessonEnd({ scheduledAt: now }) },
      (await loadTeacherLessonWindows(teacherId)).filter((w) => w.start > now),
    );
    if (hit) {
      return NextResponse.json(
        {
          error: `Yaqin orada «${hit.courseTitleUz}» — «${hit.titleUz}» darsingiz bor. Uni o‘tkazing yoki vaqtini suring.`,
          code: "CONFLICT",
        },
        { status: 409 },
      );
    }
  }

  const { lessonId, reused } = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`select pg_advisory_xact_lock(hashtext(${`quick-live:${teacherId}`}))`;
    const recent = await tx.lesson.findMany({
      where: {
        courseId: course.id,
        status: { in: ["scheduled", ...RUNNING_LESSON_STATUSES] },
        createdAt: { gte: new Date(Date.now() - DOUBLE_SUBMIT_MS) },
      },
      orderBy: { createdAt: "desc" },
    });
    const pending = recent.find(isQuickLesson);
    if (pending) return { lessonId: pending.id, reused: true };
    const created = await tx.lesson.create({
      data: { courseId: course.id, titleUz, scheduledAt: new Date() },
      select: { id: true },
    });
    return { lessonId: created.id, reused: false };
  });

  const lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId }, include: { course: true } });
  const opened = await openLobby(teacherId, lesson);
  if (opened.status !== 200) {
    if (!reused) await prisma.lesson.deleteMany({ where: { id: lessonId, status: "scheduled" } });
    return NextResponse.json(opened.body, { status: opened.status });
  }
  return NextResponse.json(opened.body, { status: reused ? 200 : 201 });
}
