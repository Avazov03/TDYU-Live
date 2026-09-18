import { AppShell } from "@/components/layout/AppShell";
import { MyCoursesBoard } from "@/components/cabinet/MyCoursesBoard";
import { requireStudentCabinet } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { isSubscriptionActive } from "@/lib/tariffs";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MyCoursesPage() {
  const { user } = await requireStudentCabinet("/my-courses");

  const subs = await prisma.subscription.findMany({
    where: { userId: user.id },
    include: {
      course: {
        include: {
          teacher: { select: { id: true, fullName: true } },
          subject: { select: { nameUz: true } },
          lessons: {
            where: { status: { in: ["live", "scheduled"] } },
            orderBy: { scheduledAt: "asc" },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AppShell active="my-courses">
      <MyCoursesBoard
        items={subs.map((sub) => {
          const active = isSubscriptionActive(sub.endsAt);
          const next = sub.course.lessons[0];
          return {
            id: sub.id,
            courseId: sub.course.id,
            title: sub.course.titleUz,
            subject: sub.course.subject.nameUz,
            teacherId: sub.course.teacher.id,
            teacherName: sub.course.teacher.fullName,
            active,
            tier: sub.tier,
            nextLabel: next
              ? `Keyingi: ${next.titleUz} · ${formatDateTime(next.scheduledAt)}`
              : "Keyingi dars yo'q",
          };
        })}
      />
    </AppShell>
  );
}
