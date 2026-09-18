import { AppShell } from "@/components/layout/AppShell";
import { AssignmentsBoard } from "@/components/cabinet/AssignmentsBoard";
import { getActiveSubscriptions, requireStudentCabinet } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { isPriorityTier } from "@/lib/tariffs";

export const dynamic = "force-dynamic";

export default async function AssignmentsPage() {
  const { user } = await requireStudentCabinet("/assignments");
  const subs = await getActiveSubscriptions(user.id);
  const courseIds = subs.map((s) => s.course.id);
  const priority = subs.some((s) => isPriorityTier(s.tier));

  const items = await prisma.assignment.findMany({
    where: { courseId: { in: courseIds } },
    include: {
      course: { include: { teacher: { select: { id: true, fullName: true } } } },
      submissions: { where: { userId: user.id } },
    },
    orderBy: { dueAt: "asc" },
  });

  return (
    <AppShell active="assignments">
      <AssignmentsBoard
        priorityNote={priority}
        items={items.map((item) => {
          const sent = item.submissions[0];
          return {
            id: item.id,
            titleUz: item.titleUz,
            descriptionUz: item.descriptionUz,
            dueAt: item.dueAt.toISOString(),
            courseId: item.courseId,
            courseTitle: item.course.titleUz,
            teacherId: item.course.teacher.id,
            teacherName: item.course.teacher.fullName,
            submitted: Boolean(sent),
            grade: sent?.grade ?? null,
            teacherNote: sent?.teacherNote ?? null,
          };
        })}
      />
    </AppShell>
  );
}
