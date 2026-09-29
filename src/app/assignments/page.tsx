import { AppShell } from "@/components/layout/AppShell";
import { AssignmentsBoard, type AssignmentState } from "@/components/cabinet/AssignmentsBoard";
import { getStudentOwnedCourses, requireStudentCabinet } from "@/lib/access";
import { getEnrollmentAccessMode } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";
import { clockLabel, dayTitle, localDayKey } from "@/lib/plan";
import { isPriorityTier } from "@/lib/tariffs";
export const dynamic = "force-dynamic";

function dueLabel(state: AssignmentState, due: Date, now: Date) {
  if (state === "late") return `Muddati o‘tgan · ${dayTitle(due)}, ${clockLabel(due)}`;
  const days = Math.round((Date.parse(localDayKey(due)) - Date.parse(localDayKey(now))) / 86_400_000);
  const when = `${dayTitle(due)}, ${clockLabel(due)} gacha`;
  if (state === "done" || days <= 1) return when;
  return `${days} kun qoldi · ${when}`;
}

export default async function AssignmentsPage() {
  const { user } = await requireStudentCabinet("/assignments");
  const owned = await getStudentOwnedCourses(user.id);
  const courseIds = owned.map((o) => o.courseId);
  const priority =
    getEnrollmentAccessMode() === "enrollment"
      ? false
      : owned.some((o) => isPriorityTier(o.tier));

  const items = await prisma.assignment.findMany({
    where: { courseId: { in: courseIds } },
    include: {
      course: { include: { teacher: { select: { id: true, fullName: true } } } },
      submissions: { where: { userId: user.id } },
    },
    orderBy: { dueAt: "asc" },
  });

  const now = new Date();

  return (
    <AppShell active="assignments">
      <AssignmentsBoard
        priorityNote={priority}
        items={items.map((item) => {
          const sent = item.submissions[0];
          const state: AssignmentState = sent ? "done" : item.dueAt < now ? "late" : "open";
          return {
            id: item.id,
            titleUz: item.titleUz,
            descriptionUz: item.descriptionUz,
            dueLabel: dueLabel(state, item.dueAt, now),
            courseTitle: item.course.titleUz,
            teacherName: item.course.teacher.fullName,
            state,
            grade: sent?.grade ?? null,
            teacherNote: sent?.teacherNote ?? null,
          };
        })}
      />
    </AppShell>
  );
}
