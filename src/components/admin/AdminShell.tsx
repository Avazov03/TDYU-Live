"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { BRAND } from "@/lib/brand";
import { Icon } from "@/components/ui/Icon";
import { useTheme } from "@/components/providers/ThemeProvider";
import { initials } from "@/lib/utils";

type AdminShellProps = {
  children: React.ReactNode;
  userName?: string;
};

const NAV = [
  { href: "/admin", label: "Boshqaruv", icon: "home" as const, exact: true },
  { href: "/admin/teachers", label: "O'qituvchilar", icon: "users" as const },
  { href: "/admin/courses", label: "Kurslar", icon: "list" as const },
  { href: "/admin/payments", label: "To'lovlar", icon: "msquare" as const },
];

export function AdminShell({ children, userName = "Admin" }: AdminShellProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <>
      <div className="topbar">
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
          <button className="iconbtn" type="button" onClick={toggleTheme} aria-label="Mavzu">
            <Icon name={theme === "dark" ? "moon" : "sun"} />
          </button>
          <span className="avatar sm">{initials(userName)}</span>
          <button type="button" className="btn btn-sm" onClick={() => signOut({ callbackUrl: "/" })}>
            Chiqish
          </button>
        </div>
      </div>
      <div className="shell">
        <div className="sidebar admin-sidebar">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`navitem${active ? " active" : ""}`}
              >
                <Icon name={item.icon} />
                <span className="navlabel">{item.label}</span>
              </Link>
            );
          })}
        </div>
        <main className="main">{children}</main>
      </div>
    </>
  );
}
