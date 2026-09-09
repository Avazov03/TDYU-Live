import { AppShell } from "@/components/layout/AppShell";
import { LessonRow } from "@/components/lesson/LessonRow";
import { requireAppUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const { user } = await requireAppUser("/history");

  const items = await prisma.attendance.findMany({
    where: { userId: user.id },
    include: { lesson: { include: { course: { select: { titleUz: true } } } } },
    orderBy: { joinedAt: "desc" },
    take: 50,
  });

  return (
    <AppShell active="history">
      <h2 style={{ marginBottom: 16 }}>Tomosha tarixi</h2>
      {items.length === 0 ? (
        <div className="empty">Hali dars ko&apos;rilmagan.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((a) => (
            <LessonRow
              key={a.id}
              id={a.lesson.id}
              titleUz={a.lesson.titleUz}
              subtitle={`${a.lesson.course.titleUz} · ${formatDateTime(a.joinedAt)}`}
              status={a.lesson.status}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
