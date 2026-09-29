import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import Link from "next/link";
import { SoftDisclosure } from "@/components/admin/SoftDisclosure";
import { CreateLessonForm } from "@/components/teacher/CreateLessonForm";
import { CreateCoursePlanForm } from "@/components/teacher/CreateCoursePlanForm";
import { TeacherRejaBoard } from "@/components/teacher/TeacherRejaBoard";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureTeacherWorkspace } from "@/lib/teacher-workspace";
import { lessonPlanLock, lifecycleLabel, liveGate } from "@/lib/course-review-policy";
import { isCourseReviewV1Enabled } from "@/lib/feature-flags";
import { lessonEnd } from "@/lib/schedule-policy";
import type { CourseLifecycleStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function TeacherRejaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/teacher/reja");
  if (session.user.role !== "teacher") redirect("/");

  const row = await prisma.teacher.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!row) redirect("/teacher");

  await ensureTeacherWorkspace(row.id);
  const teacher = await prisma.teacher.findUnique({
    where: { id: row.id },
    include: { courses: { select: { id: true, titleUz: true, lifecycleStatus: true } } },
  });
  if (!teacher) redirect("/teacher");

  const lessons = await prisma.lesson.findMany({
    where: { course: { teacherId: teacher.id } },
    include: { course: { select: { titleUz: true, lifecycleStatus: true } } },
    orderBy: { scheduledAt: "asc" },
  });
  const reviewFlow = isCourseReviewV1Enabled();
  const gateOf = (status: CourseLifecycleStatus | null) => {
    const gate = liveGate(status, reviewFlow);
    return gate ? { label: gate.label, canSubmit: gate.canSubmit } : null;
  };
  const plannable = teacher.courses.filter(
    (c) => c.lifecycleStatus !== "completed" && !lessonPlanLock(c.lifecycleStatus, reviewFlow),
  );
  const lockedCount = teacher.courses.length - plannable.length;

  return (
    <AppShell active="teacher-reja">
      <div className="lx-sc">
        <header className="lx-mc-head">
          <div>
            <p className="lx-kicker">Reja</p>
            <h1 className="lx-mc-title">Dars rejasi</h1>
            <p className="lx-mc-sub">
              {lessons.length} ta dars · {teacher.courses.length} ta kurs
            </p>
          </div>
        </header>

        <div className="lx-reja-tools">
          <SoftDisclosure
            title="Kursga dars qo‘shish"
            defaultOpen={lessons.length === 0 && plannable.length > 0}
          >
            {plannable.length > 0 ? (
              <CreateLessonForm
                courses={plannable.map((c) => ({
                  id: c.id,
                  titleUz: c.titleUz,
                  statusText: c.lifecycleStatus ? lifecycleLabel(c.lifecycleStatus).toLowerCase() : "nashrda",
                  needsReview: Boolean(gateOf(c.lifecycleStatus)?.canSubmit),
                }))}
              />
            ) : null}
            {lockedCount > 0 ? (
              <p className="small muted" style={{ margin: plannable.length ? "-8px 0 0" : 0 }}>
                {plannable.length ? `Yana ${lockedCount} ta kurs` : "Barcha kurslaringiz"} tekshiruvda yoki yakunlangan —
                ularning rejasi hozir o‘zgarmaydi.
              </p>
            ) : null}
          </SoftDisclosure>
          <SoftDisclosure title="Yangi kurs yaratish" defaultOpen={teacher.courses.length === 0}>
            <CreateCoursePlanForm />
          </SoftDisclosure>
        </div>

        {lessons.length === 0 ? (
          <div className="lx-mc-empty">
            <h2>Hali reja yo‘q</h2>
            <p>Yuqoridan kurs yoki dars qo‘shing — Studio’da kurs kartalari chiqadi.</p>
            <Link href="/teacher" className="btn btn-primary">
              Studio
            </Link>
          </div>
        ) : (
          <TeacherRejaBoard
            nowIso={new Date().toISOString()}
            lessons={lessons.map((lesson) => ({
              id: lesson.id,
              titleUz: lesson.titleUz,
              summaryUz: lesson.summaryUz,
              coverUrl: lesson.coverUrl,
              scheduledAt: lesson.scheduledAt.toISOString(),
              endsAt: lessonEnd(lesson).toISOString(),
              status: lesson.status,
              courseTitle: lesson.course.titleUz,
              recordingUrl: lesson.recordingUrl,
              playbackId: lesson.muxVodPlaybackId,
              streamKey: lesson.streamKey,
              courseGate: gateOf(lesson.course.lifecycleStatus),
              planLocked: Boolean(lessonPlanLock(lesson.course.lifecycleStatus, reviewFlow)),
            }))}
          />
        )}
      </div>
    </AppShell>
  );
}
