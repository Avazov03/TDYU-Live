"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { SearchBar } from "@/components/layout/SearchBar";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { useTheme } from "@/components/providers/ThemeProvider";
import { initials } from "@/lib/utils";
import { isAdminRole, isTeacherRole } from "@/lib/roles";
import { BRAND } from "@/lib/brand";

type TopbarProps = {
  loggedIn?: boolean;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  unreadCount?: number;
};

export function Topbar({
  loggedIn = false,
  userName,
  userEmail,
  userRole,
  unreadCount = 0,
}: TopbarProps) {
  const { theme, toggleTheme } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayName = userName ?? "Foydalanuvchi";
  const displayEmail = userEmail ?? "";

  const handleSignOut = async () => {
    setDropdownOpen(false);
    await signOut({ callbackUrl: "/" });
  };

  return (
    <div className="topbar">
      <div className="topbar-left">
        <button
          className="iconbtn"
          type="button"
          aria-label="Menyu"
          onClick={() => window.dispatchEvent(new CustomEvent("toggle-sidebar"))}
        >
          <Icon name="menu" />
        </button>
        <Link href="/" className="logo">
            <span className="mark">{BRAND.short}</span>
            <span>{BRAND.name}</span>
        </Link>
      </div>
      <SearchBar />
      <div className="topbar-right">
        <Link href="/" className="btn btn-sm">
          Bosh sahifa
        </Link>
        <button
          className="iconbtn"
          type="button"
          aria-label="Mavzu"
          onClick={toggleTheme}
        >
          <Icon name={theme === "dark" ? "moon" : "sun"} />
        </button>
        {loggedIn ? (
          <>
            {userRole && isAdminRole(userRole) ? (
              <Link href="/admin" className="btn btn-sm">
                Admin
              </Link>
            ) : null}
            {userRole && isTeacherRole(userRole) ? (
              <Link href="/teacher" className="btn btn-sm">
                Kabinet
              </Link>
            ) : null}
            {userRole === "student" ? (
              <Link href="/app" className="btn btn-primary btn-sm">
                Kabinet
              </Link>
            ) : null}
            <NotificationBell unreadCount={unreadCount} />
            <div style={{ position: "relative" }} ref={dropdownRef}>
              <button
                className="iconbtn dd-trigger"
                type="button"
                aria-label="Profil"
                onClick={() => setDropdownOpen((v) => !v)}
              >
                <span className="avatar sm">{initials(displayName)}</span>
              </button>
              <div className={`dropdown${dropdownOpen ? " open" : ""}`}>
                <div className="ddx-item">
                  <span className="avatar sm">{initials(displayName)}</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{displayName}</div>
                    {displayEmail ? (
                      <div className="small muted">{displayEmail}</div>
                    ) : null}
                  </div>
                </div>
                <div className="ddx-divider" />
                <Link className="ddx-item" href="/settings" onClick={() => setDropdownOpen(false)}>
                  <Icon name="settings" size={18} />
                  <span>Sozlamalar</span>
                </Link>
                <div className="ddx-divider" />
                <button
                  type="button"
                  className="ddx-item"
                  style={{ width: "100%", border: "none", background: "transparent", color: "inherit" }}
                  onClick={handleSignOut}
                >
                  <Icon name="logout" size={18} />
                  <span>Chiqish</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <Link href="/login" className="btn btn-primary">
            Kirish
          </Link>
        )}
      </div>
    </div>
  );
}
