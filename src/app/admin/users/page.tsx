import { AdminUsersManager, type AdminUserRow } from "@/components/admin/AdminUsersManager";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { viewerCanSeeCredentials } from "@/lib/super-admin";
import { TARIFF_SHORT, isSubscriptionActive } from "@/lib/tariffs";
import type { TariffTier } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

function tariffLabel(tier: TariffTier) {
  return TARIFF_SHORT[tier];
}

export default async function AdminStudentsPage() {
  const session = await auth();
  const canSeeSecrets = await viewerCanSeeCredentials(session?.user?.id, session?.user?.role);
  const now = new Date();

  const users = await prisma.user.findMany({
    where: { role: "student" },
    orderBy: { createdAt: "desc" },
    include: {
      entitlement: true,
      subscriptions: {
        include: {
          course: {
            select: {
              titleUz: true,
              teacher: { select: { fullName: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      certificates: { select: { id: true } },
      payments: { select: { id: true } },
      _count: { select: { attendance: true } },
    },
  });

  const rows: AdminUserRow[] = users.map((user) => {
    const activeEntitlement = user.entitlement && isSubscriptionActive(user.entitlement.endsAt)
      ? user.entitlement
      : null;
    const activeSubs = user.subscriptions.filter((sub) => isSubscriptionActive(sub.endsAt));
    const activeSub = activeSubs[0] ?? null;
    const tariffSource = activeEntitlement ?? activeSub;

    const row: AdminUserRow = {
      id: user.id,
      fullName: user.fullName,
      role: "student",
      isBlocked: user.isBlocked,
      isSuperAdmin: false,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      hasSubscription: Boolean(tariffSource),
      hasEntitlement: Boolean(activeEntitlement),
      tariff: tariffSource ? tariffLabel(tariffSource.tier) : null,
      tariffUntil: tariffSource ? tariffSource.endsAt.toISOString() : null,
      courseCount: activeSubs.length || user.subscriptions.length,
      completedCourses: user.certificates.length,
      lessonCount: user._count.attendance,
      liveCount: 0,
      studentCount: 0,
      paymentCount: user.payments.length,
      facultyName: null,
      subjectName: null,
      courses: user.subscriptions.map((sub) => ({
        subscriptionId: sub.id,
        title: sub.course.titleUz,
        lessons: 0,
        students: 0,
        tier: tariffLabel(sub.tier),
        active: isSubscriptionActive(sub.endsAt),
        endsAt: sub.endsAt.toISOString(),
        teacher: sub.course.teacher.fullName,
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
