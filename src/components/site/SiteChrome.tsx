import { auth } from "@/lib/auth";
import {
  getAnyActiveSubscription,
  getAnyOpenEnrollment,
  studentHasCabinetMembership,
} from "@/lib/access";
import { getEnrollmentAccessMode } from "@/lib/feature-flags";
import { isAdminRole, isTeacherRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { LexifyNotchNavbar } from "@/components/site/LexifyNotchNavbar";

export { SiteFooter } from "@/components/site/SiteFooter";

export async function SiteHeader() {
  const session = await auth();
  const role = session?.user?.role;
  const mode = getEnrollmentAccessMode();
  const userId = session?.user?.id;

  let cabinetHref: string | null = null;
  if (isAdminRole(role)) {
    cabinetHref = "/admin";
  } else if (isTeacherRole(role)) {
    cabinetHref = "/teacher";
  } else if (userId && role === "student") {
    const enr =
      mode === "enrollment" || mode === "dual"
        ? await getAnyOpenEnrollment(userId)
        : null;
    const sub =
      mode === "enrollment" ? null : await getAnyActiveSubscription(userId);
    if (
      studentHasCabinetMembership({
        mode,
        hasOpenEnrollment: Boolean(enr),
        hasActiveSubscription: Boolean(sub),
      })
    ) {
      cabinetHref = "/app";
    }
  }

  const profile =
    session?.user?.id
      ? await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { fullName: true, avatarUrl: true },
        })
      : null;

  const user = session?.user
    ? {
        name: profile?.fullName || session.user.name || session.user.email || "Foydalanuvchi",
        image: profile?.avatarUrl || session.user.image || null,
      }
    : null;

  return <LexifyNotchNavbar cabinetHref={cabinetHref} user={user} />;
}
