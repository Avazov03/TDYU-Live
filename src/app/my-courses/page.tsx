import { AppShell } from "@/components/layout/AppShell";
import { MyCoursesBoard } from "@/components/cabinet/MyCoursesBoard";
import { getStudentOwnedCourses, requireStudentCabinet } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import type { TariffTier } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function MyCoursesPage() {
  const { user } = await requireStudentCabinet("/my-courses");
  const owned = await getStudentOwnedCourses(user.id);
  const courseIds = owned.map((o) => o.courseId);

  const nextLessons =
    courseIds.length === 0
      ? []
      : await prisma.lesson.findMany({
          where: {
            courseId: { in: courseIds },
            status: { in: ["live", "scheduled"] },
          },
          orderBy: { scheduledAt: "asc" },
          select: { courseId: true, titleUz: true, scheduledAt: true },
        });

  const nextByCourse = new Map<string, (typeof nextLessons)[number]>();
  for (const lesson of nextLessons) {
    if (!nextByCourse.has(lesson.courseId)) {
      nextByCourse.set(lesson.courseId, lesson);
    }
  }

  type BoardItem = {
    id: string;
    courseId: string;
    title: string;
    subject: string;
    teacherId: string;
    teacherName: string;
    active: boolean;
    tier: TariffTier;
    nextLabel: string;
  };

  const items: BoardItem[] = owned.map((row) => {
    const next = nextByCourse.get(row.courseId);
    return {
      id: row.enrollmentId ?? `legacy-${row.courseId}`,
      courseId: row.courseId,
      title: row.course.titleUz,
      subject: row.course.subject.nameUz,
      teacherId: row.course.teacher.id,
      teacherName: row.course.teacher.fullName,
      active: true,
      tier: row.tier,
      nextLabel: next
        ? `Keyingi: ${next.titleUz} · ${formatDateTime(next.scheduledAt)}`
        : "Keyingi dars yo'q",
    };
  });

  return (
    <AppShell active="my-courses">
      <MyCoursesBoard items={items} />
    </AppShell>
  );
}
