"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { BRAND } from "@/lib/brand";
import { Icon } from "@/components/ui/Icon";
import { useTheme } from "@/components/providers/ThemeProvider";
import { initials } from "@/lib/utils";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";

type AdminShellProps = {
  children: React.ReactNode;
  userName?: string;
};

const NAV = [
  {
    href: "/admin",
    label: "Boshqaruv",
    hint: "Imkoniyatlar + KPI",
    icon: "home" as const,
    exact: true,
  },
  {
    href: "/admin/users",
    label: "O'quvchilar",
    hint: "Blok · obuna · parol",
    icon: "users" as const,
  },
  {
    href: "/admin/teachers",
    label: "O'qituvchilar",
    hint: "Invite · blok",
    icon: "users" as const,
  },
  {
    href: "/admin/courses",
    label: "Kurslar",
    hint: "Tahrir · nashr",
    icon: "list" as const,
  },
  {
    href: "/admin/payments",
    label: "To'lovlar",
    hint: "Kirim · filtr",
    icon: "msquare" as const,
  },
];

export function AdminShell({ children, userName = "Admin" }: AdminShellProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  return (
    <div className="admin-shell">
      <div className="topbar admin-topbar">
        <div className="topbar-left">
          <Link href="/admin" className="logo">
            <span className="mark">{BRAND.short}</span>
            <span>{BRAND.name} Studio</span>
          </Link>
        </div>
        <div className="topbar-right">
          <Link href="/" className="btn btn-sm">
            Bosh sahifa
          </Link>
          <AnimatedThemeToggler theme={theme} onThemeChange={setTheme} className="iconbtn" />
          <span className="avatar sm">{initials(userName)}</span>
          <button type="button" className="btn btn-sm" onClick={() => signOut({ callbackUrl: "/" })}>
            Chiqish
          </button>
        </div>
      </div>
      <div className="shell">
        <aside className="sidebar admin-sidebar">
          <p className="admin-nav-kicker">Tez amallar</p>
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`navitem admin-navitem${active ? " active" : ""}`}
                title={item.hint}
              >
                <Icon name={item.icon} />
                <span className="navlabel">
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </span>
              </Link>
            );
          })}
        </aside>
        <main className="main admin-main">
          <div className="main-inner">{children}</div>
        </main>
      </div>
    </div>
  );
}
