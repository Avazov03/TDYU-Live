import { AppShell } from "@/components/layout/AppShell";
import { EmptyGuide } from "@/components/cabinet/EmptyGuide";
import { PlanCard } from "@/components/cabinet/PlanCard";
import { Timeline } from "@/components/ui/aceternity-timeline";
import { getActiveSubscriptions, requireStudentCabinet } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { dayTitle, localDayKey } from "@/lib/plan";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const { user } = await requireStudentCabinet("/schedule");
  const subs = await getActiveSubscriptions(user.id);
  const courseIds = subs.map((s) => s.course.id);

  const lessons = await prisma.lesson.findMany({
    where: { courseId: { in: courseIds } },
    include: {
      course: { include: { teacher: { select: { fullName: true } } } },
    },
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
            teacher={lesson.course.teacher.fullName}
            course={lesson.course.titleUz}
            summary={lesson.summaryUz}
            coverUrl={lesson.coverUrl}
            playbackId={lesson.muxVodPlaybackId || lesson.muxLivePlaybackId}
            status={lesson.status}
          />
        ))}
      </div>
    ),
  }));

  return (
    <AppShell active="schedule">
      {data.length === 0 ? (
        <div className="lx-board">
          <p className="lx-kicker">Dars reja</p>
          <h2>Hali reja yo&apos;q</h2>
          <p className="muted small lx-lead">
            O&apos;qituvchi mavzu qo&apos;shgach shu yerda vaqt, kurs va qisqa matn chiqadi.
          </p>
          <EmptyGuide
            title="Kurslaringizni tekshiring"
            text="To‘g‘ri o‘qituvchi va kurs tanlanganini ko‘ring."
            href="/my-courses"
            cta="Kurslarim"
          />
        </div>
      ) : (
        <Timeline
          title="Dars reja"
          description="Vaqt, o'qituvchi, kurs va qisqa mazmun."
          data={data}
        />
      )}
    </AppShell>
  );
}
