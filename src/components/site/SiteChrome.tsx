import Link from "next/link";
import { auth } from "@/lib/auth";
import { getAnyActiveSubscription } from "@/lib/access";
import { isAdminRole, isTeacherRole } from "@/lib/roles";
import { BRAND } from "@/lib/brand";
import { SiteSignOut } from "@/components/site/SiteSignOut";

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

  return (
    <header className="site-nav">
      <Link href="/" className="logo">
        <span className="mark">{BRAND.short}</span>
        <span>{BRAND.name}</span>
      </Link>
      <nav className="site-nav-links">
        <Link href="/#haqida">Loyiha</Link>
        <Link href="/#tariflar">Tariflar</Link>
      </nav>
      <div className="site-nav-actions">
        {session?.user ? (
          <>
            {cabinetHref ? (
              <Link href={cabinetHref} className="btn btn-primary">
                Kabinet
              </Link>
            ) : (
              <Link href="/#tariflar" className="btn btn-primary">
                Tarif tanlash
              </Link>
            )}
            <SiteSignOut />
          </>
        ) : (
          <>
            <Link href="/login" className="btn btn-sm">
              Kirish
            </Link>
            <Link href="/register" className="btn btn-primary">
              Ro&apos;yxatdan o&apos;tish
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <b>{BRAND.name}</b>
        <p className="small muted" style={{ margin: "6px 0 0" }}>
          TDYU professorlaridan jonli dars va kurslar.
        </p>
      </div>
      <div className="small muted">© {new Date().getFullYear()} {BRAND.name}</div>
    </footer>
  );
}
