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
    include: { course: { select: { titleUz: true } } },
    orderBy: { scheduledAt: "asc" },
  });

  return (
    <AppShell active="schedule">
      <h2 style={{ marginBottom: 16 }}>Jadval</h2>
      {lessons.length === 0 ? (
        <div className="empty">Faol kurslaringizda dars yo&apos;q.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {lessons.map((lesson) => (
            <LessonRow
              key={lesson.id}
              id={lesson.id}
              titleUz={lesson.titleUz}
              subtitle={`${lesson.course.titleUz} · ${formatDateTime(lesson.scheduledAt)}`}
              status={lesson.status}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
