import { AppShell } from "@/components/layout/AppShell";
import { EmptyGuide } from "@/components/cabinet/EmptyGuide";
import { ScheduleBoard } from "@/components/cabinet/ScheduleBoard";
import { getActiveSubscriptions, requireStudentCabinet } from "@/lib/access";
import { prisma } from "@/lib/prisma";

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

  if (lessons.length === 0) {
    return (
      <AppShell active="schedule">
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
      </AppShell>
    );
  }

  return (
    <AppShell active="schedule">
      <ScheduleBoard
        lessons={lessons.map((lesson) => ({
          id: lesson.id,
          title: lesson.titleUz,
          when: lesson.scheduledAt.toISOString(),
          teacher: lesson.course.teacher.fullName,
          course: lesson.course.titleUz,
          summary: lesson.summaryUz,
          coverUrl: lesson.coverUrl,
          playbackId: lesson.muxVodPlaybackId || lesson.muxLivePlaybackId,
          recordingUrl: lesson.recordingUrl,
          status: lesson.status,
        }))}
      />
    </AppShell>
  );
}
