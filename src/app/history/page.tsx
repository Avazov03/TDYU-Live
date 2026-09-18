import { AppShell } from "@/components/layout/AppShell";
import { HistoryBoard } from "@/components/cabinet/HistoryBoard";
import { requireAppUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const { user } = await requireAppUser("/history");

  const items = await prisma.attendance.findMany({
    where: { userId: user.id },
    include: {
      lesson: {
        include: {
          course: { include: { teacher: { select: { fullName: true } } } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
    take: 50,
  });

  return (
    <AppShell active="history">
      <HistoryBoard
        items={items.map((row) => ({
          id: row.id,
          lessonId: row.lesson.id,
          title: row.lesson.titleUz,
          courseId: row.lesson.courseId,
          courseTitle: row.lesson.course.titleUz,
          teacher: row.lesson.course.teacher.fullName,
          joinedAt: row.joinedAt.toISOString(),
        }))}
      />
    </AppShell>
  );
}
