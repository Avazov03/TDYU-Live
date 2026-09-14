"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Award,
  Calendar,
  ClipboardList,
  Clapperboard,
  History,
  Home,
  LayoutDashboard,
  Library,
  MonitorPlay,
  Users,
} from "lucide-react";
import {
  DesktopSidebar,
  MobileSidebar,
  SidebarLink,
  SidebarProvider,
  useSidebar,
  type SidebarLinks,
} from "@/components/ui/aceternity-sidebar";
import { isAdminRole, isTeacherRole } from "@/lib/roles";
import { initials } from "@/lib/utils";

export type NavKey =
  | "home"
  | "shorts"
  | "history"
  | "playlists"
  | "schedule"
  | "assignments"
  | "certificates"
  | "teacher"
  | "teacher-group"
  | "teacher-assignments"
  | "admin"
  | "catalog"
  | "my-courses";

type SidebarProps = {
  active?: NavKey;
  userRole?: string;
  userName?: string;
  tariffTier?: string | null;
};

const iconClass =
  "text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

function nav(
  label: string,
  href: string,
  Icon: typeof Home,
  extra?: { title?: string; locked?: boolean },
): SidebarLinks & { title?: string; locked?: boolean } {
  return {
    label,
    href,
    title: extra?.title,
    locked: extra?.locked,
    icon: <Icon className={iconClass} />,
  };
}

function linksFor(props: SidebarProps): Array<SidebarLinks & { title?: string; locked?: boolean; key: string }> {
  const { active = "home", userRole, tariffTier } = props;
  const isHome = active === "home" || active === "catalog";
  const isSubs = active === "playlists" || active === "my-courses";
  const shortsLocked = tariffTier === "t1";

  if (isTeacherRole(userRole)) {
    return [
      { ...nav("Studio", "/teacher", MonitorPlay), key: "teacher", current: active === "teacher" },
      { ...nav("Reja", "/teacher#reja", Calendar), key: "reja" },
      { ...nav("O'quvchilar", "/teacher/group", Users), key: "group", current: active === "teacher-group" },
      { ...nav("Topshiriqlar", "/teacher/assignments", ClipboardList), key: "tasks", current: active === "teacher-assignments" },
      { ...nav("Bosh sahifa", "/", Home), key: "home" },
    ] as Array<SidebarLinks & { title?: string; locked?: boolean; key: string; current?: boolean }>;
  }

  if (isAdminRole(userRole)) {
    return [
      { ...nav("Studio", "/admin", LayoutDashboard), key: "admin", current: active === "admin" },
      { ...nav("Bosh sahifa", "/", Home), key: "home" },
    ] as Array<SidebarLinks & { title?: string; locked?: boolean; key: string; current?: boolean }>;
  }

  return [
    { ...nav("Asosiy", "/app", LayoutDashboard), key: "app", current: isHome },
    {
      ...nav("Shorts", "/shorts", Clapperboard, {
        locked: shortsLocked,
        title: shortsLocked ? "Jonli efir 2 va 3-tarifda" : undefined,
      }),
      key: "shorts",
      current: active === "shorts",
    },
    { ...nav("Obunalar", "/my-courses", Library), key: "subs", current: isSubs },
    { ...nav("Tarix", "/history", History), key: "history", current: active === "history" },
    { ...nav("Jadval", "/schedule", Calendar), key: "schedule", current: active === "schedule" },
    { ...nav("Topshiriqlar", "/assignments", ClipboardList), key: "tasks", current: active === "assignments" },
    { ...nav("Sertifikatlar", "/certificates", Award), key: "certs", current: active === "certificates" },
    { ...nav("Bosh sahifa", "/", Home), key: "site" },
  ] as Array<SidebarLinks & { title?: string; locked?: boolean; key: string; current?: boolean }>;
}

function LogoMark() {
  return (
    <div className="h-5 w-6 bg-black dark:bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
  );
}

function SidebarLogo({ href }: { href: string }) {
  const { open } = useSidebar();
  return (
    <Link
      href={href}
      className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20"
    >
      <LogoMark />
      {open ? (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="font-medium text-black dark:text-white whitespace-pre"
        >
          Lexify
        </motion.span>
      ) : null}
    </Link>
  );
}

function SidebarNav({
  items,
  userName,
  logoHref,
}: {
  items: Array<SidebarLinks & { title?: string; locked?: boolean; key: string; current?: boolean }>;
  userName: string;
  logoHref: string;
}) {
  const { setOpen } = useSidebar();
  return (
    <>
      <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <SidebarLogo href={logoHref} />
        <div className="mt-8 flex flex-col gap-2">
          {items.map((item) => (
            <SidebarLink
              key={item.key}
              link={item}
              title={item.title}
              aria-current={item.current ? "page" : undefined}
              aria-disabled={item.locked || undefined}
              className={item.locked ? "opacity-40" : undefined}
              onClick={(event) => {
                if (item.locked) {
                  event.preventDefault();
                  return;
                }
                setOpen(false);
              }}
            />
          ))}
        </div>
      </div>
      <div>
        <SidebarLink
          link={{
            label: userName,
            href: "/settings",
            icon: (
              <span className="h-7 w-7 flex-shrink-0 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-[10px] font-medium inline-flex items-center justify-center">
                {initials(userName)}
              </span>
            ),
          }}
          onClick={() => setOpen(false)}
        />
      </div>
    </>
  );
}

export function Sidebar({
  active = "home",
  userRole,
  userName,
  tariffTier,
}: SidebarProps) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const displayName = userName?.trim() || "Profil";
  const items = linksFor({ active, userRole, tariffTier });
  const logoHref = isTeacherRole(userRole) ? "/teacher" : isAdminRole(userRole) ? "/admin" : "/app";

  useEffect(() => {
    const handler = () => {
      if (window.matchMedia("(max-width: 767px)").matches) {
        setOpen((value) => !value);
      }
    };
    window.addEventListener("toggle-sidebar", handler);
    return () => window.removeEventListener("toggle-sidebar", handler);
  }, []);

  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={!reduced}>
      <DesktopSidebar className="justify-between gap-10 h-full">
        <SidebarNav items={items} userName={displayName} logoHref={logoHref} />
      </DesktopSidebar>
      <MobileSidebar className="justify-between gap-10">
        <SidebarNav items={items} userName={displayName} logoHref={logoHref} />
      </MobileSidebar>
    </SidebarProvider>
  );
}
