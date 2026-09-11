import { auth } from "@/lib/auth";
import { getAnyActiveSubscription } from "@/lib/access";
import { isAdminRole, isTeacherRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { LexifyNotchNavbar } from "@/components/site/LexifyNotchNavbar";

export { SiteFooter } from "@/components/site/SiteFooter";

export async function SiteHeader() {
  const session = await auth();
  const role = session?.user?.role;
  const sub =
    session?.user?.id && role === "student"
      ? await getAnyActiveSubscription(session.user.id)
      : null;

  const cabinetHref = isAdminRole(role)
    ? "/admin"
    : isTeacherRole(role)
      ? "/teacher"
      : sub
        ? "/app"
        : null;

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
