import { AppShell } from "@/components/layout/AppShell";
import { MyCoursesBoard } from "@/components/cabinet/MyCoursesBoard";
import { requireStudentCabinet } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { isSubscriptionActive } from "@/lib/tariffs";
import { formatDateTime } from "@/lib/utils";
import type { TariffTier } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function MyCoursesPage() {
  const { user } = await requireStudentCabinet("/my-courses");

  const [subs, enrollments] = await Promise.all([
    prisma.subscription.findMany({
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
    }),
    prisma.enrollment.findMany({
      where: {
        userId: user.id,
        accessOpen: true,
        status: { in: ["active", "completed"] },
      },
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
    }),
  ]);

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

  const byCourse = new Map<string, BoardItem>();

  for (const sub of subs) {
    const active = isSubscriptionActive(sub.endsAt);
    const next = sub.course.lessons[0];
    byCourse.set(sub.course.id, {
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
    });
  }

  // Additive: Enrollment-only seats (Checkout V2) appear when no Subscription row.
  for (const enr of enrollments) {
    if (byCourse.has(enr.course.id)) continue;
    const next = enr.course.lessons[0];
    byCourse.set(enr.course.id, {
      id: enr.id,
      courseId: enr.course.id,
      title: enr.course.titleUz,
      subject: enr.course.subject.nameUz,
      teacherId: enr.course.teacher.id,
      teacherName: enr.course.teacher.fullName,
      active: true,
      tier: "t2",
      nextLabel: next
        ? `Keyingi: ${next.titleUz} · ${formatDateTime(next.scheduledAt)}`
        : "Keyingi dars yo'q",
    });
  }

  return (
    <AppShell active="my-courses">
      <MyCoursesBoard items={[...byCourse.values()]} />
    </AppShell>
  );
}
