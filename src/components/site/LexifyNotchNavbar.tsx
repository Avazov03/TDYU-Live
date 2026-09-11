"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { signOut } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  CircleHelp,
  CreditCard,
  Menu,
  Moon,
  Sun,
  X,
} from "lucide-react";
import { initials } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
import { useTheme } from "@/components/providers/ThemeProvider";

type Props = {
  cabinetHref?: string | null;
  user?: { name: string; image?: string | null } | null;
};

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
};

const NAV: NavItem[] = [
  { label: "Qanday", href: "/#qanday", icon: CircleHelp },
  { label: "Loyiha", href: "/#haqida", icon: BookOpen },
  { label: "Tariflar", href: "/#tariflar", icon: CreditCard },
];

function NavLink({ href, icon: Icon, label }: NavItem) {
  return (
    <Link href={href} className="vn-link">
      <Icon size={16} aria-hidden />
      <span>{label}</span>
    </Link>
  );
}

function Avatar({ name, image }: { name: string; image?: string | null }) {
  if (image) {
    return <Image src={image} alt={name} width={28} height={28} className="vn-avatar" unoptimized />;
  }
  return <span className="vn-avatar vn-avatar-fallback">{initials(name || "U") || "U"}</span>;
}

function ThemeBtn() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button type="button" className="vn-icon-btn" onClick={toggleTheme} aria-label="Mavzu">
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

export function LexifyNotchNavbar({ cabinetHref, user }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="vn-header">
        <div className="vn-wing" aria-hidden>
          <svg className="vn-wing-lines" preserveAspectRatio="none">
            <line x1="0" y1="39.5" x2="100%" y2="39.5" />
            <line x1="0" y1="36.5" x2="100%" y2="36.5" />
          </svg>
        </div>

        <div className="vn-notch">
          <div className="vn-curve vn-curve-l" aria-hidden>
            <div className="vn-curve-fill" />
            <svg className="vn-curve-lines" viewBox="0 0 50 64">
              <path d="M0 39.5 C25 39.5 25 63.5 50 63.5" />
              <path d="M0 36.5 C25 36.5 25 60.5 50 60.5" />
            </svg>
          </div>

          <div className="vn-panel">
            <svg className="vn-panel-lines" preserveAspectRatio="none" aria-hidden>
              <line x1="0" y1="63.5" x2="100%" y2="63.5" />
              <line x1="0" y1="60.5" x2="100%" y2="60.5" />
            </svg>

            <div className="vn-brand">
              <button
                type="button"
                className="vn-menu"
                aria-label="Menyu"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
              >
                {open ? <X size={20} /> : <Menu size={20} />}
              </button>
              <Link href="/" className="vn-logo" aria-label={BRAND.name}>
                <span className="vn-logo-mark">{BRAND.short}</span>
                <span className="vn-logo-text">{BRAND.name}</span>
              </Link>
            </div>

            <div className="vn-right">
              <nav className="vn-nav">
                {NAV.map((item) => (
                  <NavLink key={item.href} {...item} />
                ))}
              </nav>

              <div className="vn-actions">
                <ThemeBtn />
                {user ? (
                  <>
                    <Link
                      href={cabinetHref || "/#tariflar"}
                      className="vn-user"
                      title={user.name}
                    >
                      <Avatar name={user.name} image={user.image} />
                      <span className="vn-name">{user.name}</span>
                    </Link>
                    <Link href={cabinetHref || "/#tariflar"} className="vn-cta">
                      {cabinetHref ? "Kabinet" : "Tarif"}
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/login" className="vn-text-link">
                      Kirish
                    </Link>
                    <Link href="/register" className="vn-cta">
                      Ro&apos;yxat
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="vn-curve vn-curve-r" aria-hidden>
            <div className="vn-curve-fill" />
            <svg className="vn-curve-lines" viewBox="0 0 50 64">
              <path d="M0 63.5 C25 63.5 25 39.5 50 39.5" />
              <path d="M0 60.5 C25 60.5 25 36.5 50 36.5" />
            </svg>
          </div>
        </div>

        <div className="vn-wing" aria-hidden>
          <svg className="vn-wing-lines" preserveAspectRatio="none">
            <line x1="0" y1="39.5" x2="100%" y2="39.5" />
            <line x1="0" y1="36.5" x2="100%" y2="36.5" />
          </svg>
        </div>
      </header>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="vn-drawer"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.2 }}
          >
            <nav className="vn-drawer-nav">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="vn-drawer-link" onClick={() => setOpen(false)}>
                  <item.icon size={18} aria-hidden />
                  <span>{item.label}</span>
                </Link>
              ))}
              <div className="vn-drawer-sep" />
              {user ? (
                <>
                  <div className="vn-drawer-user">
                    <Avatar name={user.name} image={user.image} />
                    <span>{user.name}</span>
                  </div>
                  <Link href={cabinetHref || "/#tariflar"} className="vn-cta vn-drawer-cta" onClick={() => setOpen(false)}>
                    {cabinetHref ? "Kabinet" : "Tarif"}
                  </Link>
                  <button type="button" className="vn-drawer-link" onClick={() => signOut({ callbackUrl: "/" })}>
                    Chiqish
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="vn-drawer-link" onClick={() => setOpen(false)}>
                    Kirish
                  </Link>
                  <Link href="/register" className="vn-cta vn-drawer-cta" onClick={() => setOpen(false)}>
                    Ro&apos;yxatdan o&apos;tish
                  </Link>
                </>
              )}
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
