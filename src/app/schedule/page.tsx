import { AppShell } from "@/components/layout/AppShell";
import { LessonRow } from "@/components/lesson/LessonRow";
import { requireStudentCabinet } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const { user } = await requireStudentCabinet("/schedule");

  const lessons = await prisma.lesson.findMany({
    where: {
      course: {
        subscriptions: {
          some: { userId: user.id, endsAt: { gt: new Date() } },
        },
      },
    },
    include: {
      course: {
        select: {
          titleUz: true,
          teacher: { select: { fullName: true } },
        },
      },
    },
    orderBy: { scheduledAt: "asc" },
  });
  const rank = { live: 0, scheduled: 1, ended: 2 } as const;
  lessons.sort((a, b) => rank[a.status] - rank[b.status]);

  return (
    <AppShell active="schedule">
      <h2 style={{ marginBottom: 8 }}>Jadval</h2>
      <p className="muted small" style={{ marginBottom: 16 }}>
        O&apos;qituvchingizning dars rejalari. Jonli boshlanganda shu yerda «Jonli» chiqadi.
      </p>
      {lessons.length === 0 ? (
        <div className="empty">Faol kurslaringizda dars yo&apos;q.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {lessons.map((lesson) => (
            <LessonRow
              key={lesson.id}
              id={lesson.id}
              titleUz={lesson.titleUz}
              subtitle={`${lesson.course.teacher.fullName} · ${lesson.course.titleUz} · ${formatDateTime(lesson.scheduledAt)}`}
              status={lesson.status}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
