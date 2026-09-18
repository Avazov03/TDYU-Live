import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PlanCard } from "@/components/cabinet/PlanCard";
import { EmptyGuide } from "@/components/cabinet/EmptyGuide";
import { SoftDisclosure } from "@/components/admin/SoftDisclosure";
import { CreateLessonForm } from "@/components/teacher/CreateLessonForm";
import { LessonActions } from "@/components/teacher/LessonActions";
import { Timeline } from "@/components/ui/aceternity-timeline";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureTeacherWorkspace } from "@/lib/teacher-workspace";
import { dayTitle, localDayKey } from "@/lib/plan";

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
    include: { courses: { select: { id: true, titleUz: true } } },
  });
  if (!teacher) redirect("/teacher");

  const lessons = await prisma.lesson.findMany({
    where: { course: { teacherId: teacher.id } },
    include: { course: { select: { titleUz: true } } },
    orderBy: { scheduledAt: "asc" },
  });

  const byDay = new Map<string, typeof lessons>();
  for (const lesson of lessons) {
    const key = localDayKey(lesson.scheduledAt);
    const list = byDay.get(key) ?? [];
    list.push(lesson);
    byDay.set(key, list);
  }

  const data = [...byDay.entries()].map(([key, items]) => ({
    key,
    title: dayTitle(items[0]?.scheduledAt ?? new Date(key)),
    content: (
      <div className="lx-stack">
        {items.map((lesson) => (
          <PlanCard
            key={lesson.id}
            id={lesson.id}
            title={lesson.titleUz}
            when={lesson.scheduledAt}
            teacher={teacher.fullName}
            course={lesson.course.titleUz}
            summary={lesson.summaryUz}
            coverUrl={lesson.coverUrl}
            playbackId={lesson.muxVodPlaybackId || lesson.muxLivePlaybackId}
            recordingUrl={lesson.recordingUrl}
            status={lesson.status}
            actions={
              <LessonActions
                lessonId={lesson.id}
                status={lesson.status}
                streamKey={lesson.streamKey}
                titleUz={lesson.titleUz}
                summaryUz={lesson.summaryUz}
                coverUrl={lesson.coverUrl}
                scheduledAt={lesson.scheduledAt.toISOString()}
              />
            }
          />
        ))}
      </div>
    ),
  }));

  return (
    <AppShell active="teacher-reja">
      <div className="lx-board" style={{ marginBottom: 12 }}>
        <p className="lx-kicker">Reja</p>
        <h2>Dars rejangiz</h2>
        <p className="muted small lx-lead">
          Mavzu qo‘shing, tahrirlang yoki o‘chiring. O‘quvchi ham shu jadvalni ko‘radi.
        </p>
      </div>
      <SoftDisclosure title="Mavzu qo‘shish" defaultOpen={data.length === 0}>
        <CreateLessonForm courses={teacher.courses.map((c) => ({ id: c.id, titleUz: c.titleUz }))} />
      </SoftDisclosure>
      {data.length === 0 ? (
        <EmptyGuide
          title="Hali reja yo‘q"
          text="Yuqoridan mavzu, vaqt va qisqa matn qo‘shing."
          href="/teacher"
          cta="Studio"
        />
      ) : (
        <Timeline
          title="Dars reja"
          description="Vaqt, kurs va qisqa mazmun. Tahrirlash tugmasi har darsda."
          data={data}
        />
      )}
    </AppShell>
  );
}
