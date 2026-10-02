"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { BRAND } from "@/lib/brand";
import {
  Award,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  Presentation,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { initials } from "@/lib/utils";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { RoleBadge } from "@/components/layout/RoleBadge";

type AdminShellProps = {
  children: React.ReactNode;
  userName?: string;
  /** null = course review flow is off (no «Tekshiruv» section). */
  reviewCount?: number | null;
};

type NavItem = { href: string; label: string; hint: string; icon: LucideIcon; exact?: boolean; badge?: number };

const NAV: NavItem[] = [
  { href: "/admin", label: "Bugun", hint: "KPI · diqqat", icon: LayoutDashboard, exact: true },
  { href: "/admin/review", label: "Tekshiruv", hint: "Tasdiqlash · nashr", icon: ClipboardCheck },
  { href: "/admin/users", label: "O‘quvchilar", hint: "Blok · obuna · parol", icon: GraduationCap },
  { href: "/admin/teachers", label: "O‘qituvchilar", hint: "Taklif · blok", icon: Presentation },
  { href: "/admin/courses", label: "Kurslar", hint: "Ro‘yxat · tahrir", icon: BookOpen },
  { href: "/admin/payments", label: "To‘lovlar", hint: "Kirim · qaytarish", icon: Wallet },
  { href: "/admin/certificates", label: "Sertifikatlar", hint: "Berilgan · bekor", icon: Award },
];

function isActive(pathname: string, item: { href: string; exact?: boolean }) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

export function AdminShell({ children, userName = "Admin", reviewCount = null }: AdminShellProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const nav = NAV.flatMap((item) => {
    if (item.href !== "/admin/review") return [item];
    return reviewCount == null ? [] : [{ ...item, badge: reviewCount }];
  });

  return (
    <div className="admin-shell lx-admin-shell">
      <div className="topbar admin-topbar lx-admin-topbar">
        <div className="topbar-left">
          <Link href="/admin" className="logo lx-admin-logo">
            <span className="mark">{BRAND.logo.mark}</span>
            <span className="lx-admin-brand">{BRAND.logo.text}</span>
          </Link>
        </div>
        <div className="topbar-right">
          <Link href="/" className="btn btn-sm lx-admin-home">
            Bosh sahifa
          </Link>
          <AnimatedThemeToggler theme={theme} onThemeChange={setTheme} className="iconbtn" />
          <RoleBadge role="admin" />
          <Link href="/settings" className="avatar sm" title="Profil" style={{ textDecoration: "none" }}>
            {initials(userName)}
          </Link>
          <button type="button" className="btn btn-sm" onClick={() => signOut({ callbackUrl: "/" })}>
            Chiqish
          </button>
        </div>
      </div>
      <nav className="lx-admin-tabs" aria-label="Admin bo‘limlari">
        {nav.map((item) => {
          const active = isActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`lx-admin-tab${active ? " is-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <item.icon size={16} aria-hidden />
              {item.label}
              {item.badge ? (
                <span className="lx-nav-count" aria-label={`${item.badge} ta kutmoqda`}>
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="shell">
        <aside className="sidebar admin-sidebar lx-admin-sidebar">
          <p className="admin-nav-kicker lx-kicker" style={{ marginLeft: 12 }}>
            Admin panel
          </p>
          {nav.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`navitem admin-navitem${active ? " active" : ""}`}
                title={item.hint}
                aria-current={active ? "page" : undefined}
              >
                <item.icon size={20} aria-hidden />
                <span className="navlabel">
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </span>
                {item.badge ? (
                  <span className="lx-nav-count" aria-label={`${item.badge} ta kutmoqda`}>
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </aside>
        <main className="main admin-main">
          <div className="main-inner lx-admin-main-inner">{children}</div>
        </main>
      </div>
    </div>
  );
}
