import { AppShell } from "@/components/layout/AppShell";
import { HistoryBoard } from "@/components/cabinet/HistoryBoard";
import { requireAppUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { hasPlayableRecording } from "@/lib/plan";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const { user } = await requireAppUser("/history");

  const [items, completed] = await Promise.all([
    prisma.attendance.findMany({
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
    }),
    prisma.enrollment.findMany({
      where: {
        userId: user.id,
        accessOpen: true,
        OR: [{ status: "completed" }, { course: { lifecycleStatus: "completed" } }],
      },
      orderBy: { completedAt: "desc" },
      select: {
        id: true,
        completedAt: true,
        course: {
          select: {
            id: true,
            titleUz: true,
            teacher: { select: { fullName: true } },
            _count: { select: { lessons: { where: { status: "published" } } } },
          },
        },
      },
    }),
  ]);

  return (
    <AppShell active="history">
      <HistoryBoard
        completedCourses={completed.map((row) => ({
          id: row.id,
          courseId: row.course.id,
          title: row.course.titleUz,
          teacher: row.course.teacher.fullName,
          completedAt: row.completedAt?.toISOString() ?? null,
          recordings: row.course._count.lessons,
        }))}
        items={items.map((row) => ({
          id: row.id,
          lessonId: row.lesson.id,
          title: row.lesson.titleUz,
          courseId: row.lesson.courseId,
          courseTitle: row.lesson.course.titleUz,
          teacher: row.lesson.course.teacher.fullName,
          joinedAt: row.joinedAt.toISOString(),
          status: row.lesson.status,
          hasRecording: hasPlayableRecording(row.lesson.recordingUrl, row.lesson.muxVodPlaybackId),
        }))}
      />
    </AppShell>
  );
}
