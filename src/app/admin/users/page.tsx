import { AdminUsersManager, type AdminUserRow } from "@/components/admin/AdminUsersManager";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdminEmail, viewerCanSeeCredentials } from "@/lib/super-admin";
import { TARIFF_SHORT } from "@/lib/tariffs";
import type { TariffTier } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

function tariffLabel(tier: TariffTier) {
  return TARIFF_SHORT[tier];
}

export default async function AdminUsersPage() {
  const session = await auth();
  const canSeeSecrets = await viewerCanSeeCredentials(session?.user?.id, session?.user?.role);
  const now = new Date();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      entitlement: true,
      subscriptions: {
        include: { course: { select: { titleUz: true } } },
        orderBy: { createdAt: "desc" },
      },
      certificates: { select: { id: true } },
      payments: { select: { id: true } },
      teacherProfile: {
        include: {
          faculty: { select: { nameUz: true } },
          subject: { select: { nameUz: true } },
          courses: {
            select: {
              titleUz: true,
              lessons: { select: { status: true } },
              subscriptions: { select: { userId: true } },
            },
          },
        },
      },
      _count: { select: { attendance: true } },
    },
  });

  const rows: AdminUserRow[] = users.map((user) => {
    const activeEntitlement = user.entitlement && user.entitlement.endsAt > now ? user.entitlement : null;
    const activeSub = user.subscriptions.find((sub) => sub.endsAt > now) ?? null;
    const tariffSource = activeEntitlement ?? activeSub;
    const teacher = user.teacherProfile;
    const studentIds = new Set<string>();
    let lessonCount = user._count.attendance;
    let liveCount = 0;

    if (teacher) {
      lessonCount = 0;
      for (const course of teacher.courses) {
        lessonCount += course.lessons.length;
        liveCount += course.lessons.filter((lesson) => lesson.status === "live" || lesson.status === "ended").length;
        for (const sub of course.subscriptions) studentIds.add(sub.userId);
      }
    }

    const row: AdminUserRow = {
      id: user.id,
      fullName: user.fullName,
      role: user.role,
      isBlocked: user.isBlocked,
      isSuperAdmin: isSuperAdminEmail(user.email),
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      hasSubscription: Boolean(tariffSource),
      tariff: tariffSource ? tariffLabel(tariffSource.tier) : null,
      tariffUntil: tariffSource ? tariffSource.endsAt.toISOString() : null,
      courseCount: teacher ? teacher.courses.length : user.subscriptions.length,
      completedCourses: user.certificates.length,
      lessonCount,
      liveCount,
      studentCount: studentIds.size,
      paymentCount: user.payments.length,
      facultyName: teacher?.faculty.nameUz ?? null,
      subjectName: teacher?.subject.nameUz ?? null,
      courses: teacher
        ? teacher.courses.map((course) => ({
            title: course.titleUz,
            lessons: course.lessons.length,
            students: new Set(course.subscriptions.map((sub) => sub.userId)).size,
          }))
        : user.subscriptions.map((sub) => ({
            title: sub.course.titleUz,
            lessons: 0,
            students: 0,
            tier: tariffLabel(sub.tier),
            active: sub.endsAt > now,
            endsAt: sub.endsAt.toISOString(),
          })),
    };

    if (canSeeSecrets) {
      row.email = user.email;
      row.hasPassword = Boolean(user.passwordHash);
      row.loginViaGoogle = Boolean(user.googleId);
    }

    return row;
  });

  return <AdminUsersManager users={rows} canSeeSecrets={canSeeSecrets} />;
}
