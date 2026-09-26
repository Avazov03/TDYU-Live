import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { TeacherGroupBoard } from "@/components/teacher/TeacherGroupBoard";
import { auth } from "@/lib/auth";
import { getEnrollmentAccessMode } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";
import { isSubscriptionActive } from "@/lib/tariffs";
import { ensureTeacherWorkspace } from "@/lib/teacher-workspace";
import type { TariffTier } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

type Member = {
  rowId: string;
  userId: string;
  fullName: string;
  email: string;
  tier: TariffTier | null;
  endsAt: string | null;
};

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
  const mode = getEnrollmentAccessMode();
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
          enrollments: {
            where: { accessOpen: true, status: { in: ["active", "completed"] } },
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
    const members = new Map<string, Member>();
    if (mode === "enrollment" || mode === "dual") {
      for (const e of course.enrollments) {
        members.set(e.userId, {
          rowId: e.id,
          userId: e.userId,
          fullName: e.user.fullName,
          email: e.user.email,
          tier: null,
          endsAt: null,
        });
      }
    }
    if (mode !== "enrollment") {
      for (const s of course.subscriptions) {
        if (!isSubscriptionActive(s.endsAt) || members.has(s.userId)) continue;
        members.set(s.userId, {
          rowId: s.id,
          userId: s.userId,
          fullName: s.user.fullName,
          email: s.user.email,
          tier: s.tier,
          endsAt: s.endsAt.toISOString(),
        });
      }
    }
    const active = [...members.values()];

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
          ...s,
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
      <TeacherGroupBoard courses={courses} showTiers={mode !== "enrollment"} />
    </AppShell>
  );
}
