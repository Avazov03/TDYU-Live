import Link from "next/link";
import { auth } from "@/lib/auth";
import { getAnyActiveSubscription } from "@/lib/access";
import { isAdminRole, isTeacherRole } from "@/lib/roles";
import { BRAND } from "@/lib/brand";
import { prisma } from "@/lib/prisma";
import { LexifyNotchNavbar } from "@/components/site/LexifyNotchNavbar";

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

export function SiteFooter() {
  return (
    <footer className="lx-footer">
      <div className="lx-footer-inner">
        <div className="lx-footer-brand">
          <span className="lx-footer-name">{BRAND.name}</span>
          <p>TDYU professorlaridan jonli dars va kurslar.</p>
        </div>
        <nav className="lx-footer-nav" aria-label="Pastki menyu">
          <Link href="/#qanday">Qanday</Link>
          <Link href="/#haqida">Loyiha</Link>
          <Link href="/#tariflar">Tariflar</Link>
        </nav>
        <p className="lx-footer-copy">© {new Date().getFullYear()} {BRAND.name}</p>
      </div>
    </footer>
  );
}
