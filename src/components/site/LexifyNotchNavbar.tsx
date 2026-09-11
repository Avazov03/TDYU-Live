"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  CircleHelp,
  CreditCard,
  Home,
  Menu,
  X,
} from "lucide-react";
import { initials } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
import { useTheme } from "@/components/providers/ThemeProvider";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";

type Props = {
  cabinetHref?: string | null;
  user?: { name: string; image?: string | null } | null;
};

type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
};

const NAV: NavItem[] = [
  { id: "bosh", label: "Bosh sahifa", href: "/#bosh", icon: Home },
  { id: "qanday", label: "Qanday", href: "/#qanday", icon: CircleHelp },
  { id: "haqida", label: "Loyiha", href: "/#haqida", icon: BookOpen },
  { id: "tariflar", label: "Tariflar", href: "/#tariflar", icon: CreditCard },
];

const SECTION_IDS = NAV.map((item) => item.id);

function scrollToSection(id: string) {
  if (id === "bosh") {
    window.scrollTo({ top: 0, behavior: "smooth" });
    history.replaceState(null, "", "/#bosh");
    return;
  }
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  history.replaceState(null, "", `/#${id}`);
}

function useActiveSection() {
  const pathname = usePathname();
  const [active, setActive] = useState("bosh");

  useEffect(() => {
    if (pathname !== "/") return;

    const syncFromHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash && SECTION_IDS.includes(hash)) setActive(hash);
    };
    syncFromHash();

    const onScroll = () => {
      if (window.scrollY < 80) {
        setActive("bosh");
        return;
      }
      let current = "bosh";
      for (const id of SECTION_IDS) {
        if (id === "bosh") continue;
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= 120) current = id;
      }
      setActive(current);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("hashchange", syncFromHash);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("hashchange", syncFromHash);
    };
  }, [pathname]);

  return pathname === "/" ? active : null;
}

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={`vn-link${active ? " is-active" : ""}`}
      aria-current={active ? "page" : undefined}
      onClick={(e) => {
        if (pathname === "/") {
          e.preventDefault();
          scrollToSection(item.id);
        }
        onNavigate?.();
      }}
    >
      <Icon size={16} aria-hidden />
      <span>{item.label}</span>
    </Link>
  );
}

function Avatar({ name, image }: { name: string; image?: string | null }) {
  if (image) {
    return <Image src={image} alt={name} width={28} height={28} className="vn-avatar" unoptimized />;
  }
  return <span className="vn-avatar vn-avatar-fallback">{initials(name || "U") || "U"}</span>;
}

function ThemeBtn({ onPop }: { onPop: () => void }) {
  const { theme, setTheme } = useTheme();
  return (
    <AnimatedThemeToggler
      theme={theme}
      duration={520}
      onThemeChange={(next) => {
        onPop();
        setTheme(next);
      }}
      className="vn-theme-toggle"
    />
  );
}

export function LexifyNotchNavbar({ cabinetHref, user }: Props) {
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const popTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useActiveSection();
  const pathname = usePathname();

  const popHeader = () => {
    const el = headerRef.current;
    if (!el) return;
    el.classList.remove("is-theme-pop");
    void el.offsetWidth;
    el.classList.add("is-theme-pop");
    if (popTimer.current) clearTimeout(popTimer.current);
    popTimer.current = setTimeout(() => el.classList.remove("is-theme-pop"), 700);
  };

  useEffect(() => {
    return () => {
      if (popTimer.current) clearTimeout(popTimer.current);
    };
  }, []);

  useEffect(() => {
    if (pathname !== "/") return;
    const hash = window.location.hash.replace("#", "");
    if (!hash || !SECTION_IDS.includes(hash)) return;
    requestAnimationFrame(() => scrollToSection(hash));
  }, [pathname]);

  return (
    <>
      <header className="vn-header" ref={headerRef}>
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
                aria-label={open ? "Menyuni yopish" : "Menyuni ochish"}
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
              >
                {open ? <X size={20} /> : <Menu size={20} />}
              </button>
              <Link
                href="/#bosh"
                className="vn-logo"
                aria-label={BRAND.name}
                onClick={(e) => {
                  if (pathname === "/") {
                    e.preventDefault();
                    scrollToSection("bosh");
                  }
                }}
              >
                <span className="vn-logo-mark">{BRAND.short}</span>
                <span className="vn-logo-text">{BRAND.name}</span>
              </Link>
            </div>

            <div className="vn-right">
              <nav className="vn-nav" aria-label="Asosiy menyu">
                {NAV.map((item) => (
                  <NavLink
                    key={item.id}
                    item={item}
                    active={active === item.id}
                  />
                ))}
              </nav>

              <div className="vn-actions">
                <ThemeBtn onPop={popHeader} />
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
            <nav className="vn-drawer-nav" aria-label="Mobil menyu">
              {NAV.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`vn-drawer-link${active === item.id ? " is-active" : ""}`}
                  aria-current={active === item.id ? "page" : undefined}
                  onClick={(e) => {
                    if (pathname === "/") {
                      e.preventDefault();
                      scrollToSection(item.id);
                    }
                    setOpen(false);
                  }}
                >
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
