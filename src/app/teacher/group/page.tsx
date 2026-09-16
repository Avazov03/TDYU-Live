import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { TeacherGroupBoard } from "@/components/teacher/TeacherGroupBoard";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSubscriptionActive } from "@/lib/tariffs";
import { ensureTeacherWorkspace } from "@/lib/teacher-workspace";

export const dynamic = "force-dynamic";

export default async function TeacherGroupPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/teacher/group");
  if (session.user.role !== "teacher") redirect("/");

  const teacher = await prisma.teacher.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!teacher) redirect("/teacher");

  await ensureTeacherWorkspace(teacher.id);
  const workspace = await prisma.teacher.findUnique({
    where: { id: teacher.id },
    include: {
      courses: {
        include: {
          subscriptions: {
            include: {
              user: { select: { id: true, fullName: true, email: true } },
            },
          },
          certificates: true,
          lessons: {
            include: { attendance: true },
          },
        },
      },
    },
  });
  if (!workspace) redirect("/teacher");

  const courses = workspace.courses.map((course) => {
    const active = course.subscriptions.filter((s) => isSubscriptionActive(s.endsAt));
    const attendedSum = active.reduce((n, s) => {
      return n + course.lessons.filter((l) => l.attendance.some((a) => a.userId === s.userId)).length;
    }, 0);
    const attendPct =
      active.length && course.lessons.length
        ? Math.round((attendedSum / (active.length * course.lessons.length)) * 100)
        : 0;

    return {
      id: course.id,
      titleUz: course.titleUz,
      activeCount: active.length,
      t1: active.filter((s) => s.tier === "t1").length,
      t2: active.filter((s) => s.tier === "t2").length,
      t3: active.filter((s) => s.tier === "t3").length,
      attendPct,
      lessonCount: course.lessons.length,
      students: active.map((s) => {
        const seen = course.lessons.filter((l) => l.attendance.some((a) => a.userId === s.userId));
        const attended = seen.length;
        const pct = course.lessons.length ? Math.round((attended / course.lessons.length) * 100) : 0;
        return {
          subscriptionId: s.id,
          userId: s.userId,
          fullName: s.user.fullName,
          email: s.user.email,
          tier: s.tier,
          endsAt: s.endsAt.toISOString(),
          attended,
          lessonCount: course.lessons.length,
          pct,
          hasCert: course.certificates.some((c) => c.userId === s.userId),
          seenTitles: seen.map((l) => l.titleUz),
        };
      }),
    };
  });

  return (
    <AppShell active="teacher-group">
      <TeacherGroupBoard courses={courses} />
    </AppShell>
  );
}
