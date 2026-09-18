"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Award,
  Calendar,
  ChevronDown,
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
import { SoftExpand } from "@/components/admin/SoftDisclosure";
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
  | "teacher-reja"
  | "admin"
  | "catalog"
  | "my-courses";

type SidebarProps = {
  active?: NavKey;
  userRole?: string;
  userName?: string;
  tariffTier?: string | null;
};

type NavItem = SidebarLinks & {
  title?: string;
  locked?: boolean;
  key: string;
  current?: boolean;
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

function studentNav(props: SidebarProps): { primary: NavItem[]; more: NavItem[] } {
  const { active, tariffTier } = props;
  const isHome = active === "home";
  const isSubs = active === "playlists" || active === "my-courses";
  const shortsLocked = tariffTier === "t1";

  const primary: NavItem[] = [
    { ...nav("Bugun", "/app", LayoutDashboard), key: "app", current: isHome },
    { ...nav("Kurslarim", "/my-courses", Library), key: "subs", current: isSubs },
    { ...nav("Dars reja", "/schedule", Calendar), key: "schedule", current: active === "schedule" },
  ];

  const more: NavItem[] = [
    ...(shortsLocked
      ? []
      : [
          {
            ...nav("Shorts", "/shorts", Clapperboard),
            key: "shorts",
            current: active === "shorts",
          } as NavItem,
        ]),
    { ...nav("Ko'rilganlar", "/history", History), key: "history", current: active === "history" },
    { ...nav("Topshiriqlar", "/assignments", ClipboardList), key: "tasks", current: active === "assignments" },
    { ...nav("Sertifikatlar", "/certificates", Award), key: "certs", current: active === "certificates" },
    { ...nav("Bosh sahifa", "/", Home), key: "site" },
  ];

  return { primary, more };
}

function linksFor(props: SidebarProps): NavItem[] {
  const { active, userRole } = props;

  if (isTeacherRole(userRole)) {
    return [
      { ...nav("Studio", "/teacher", MonitorPlay), key: "teacher", current: active === "teacher" },
      { ...nav("Reja", "/teacher/reja", Calendar), key: "reja", current: active === "teacher-reja" },
      { ...nav("O'quvchilar", "/teacher/group", Users), key: "group", current: active === "teacher-group" },
      { ...nav("Topshiriqlar", "/teacher/assignments", ClipboardList), key: "tasks", current: active === "teacher-assignments" },
      { ...nav("Bosh sahifa", "/", Home), key: "home" },
    ];
  }

  if (isAdminRole(userRole)) {
    return [
      { ...nav("Studio", "/admin", LayoutDashboard), key: "admin", current: active === "admin" },
      { ...nav("Bosh sahifa", "/", Home), key: "home" },
    ];
  }

  const { primary, more } = studentNav(props);
  return [...primary, ...more];
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

function NavLinks({
  items,
  onNavigate,
}: {
  items: NavItem[];
  onNavigate: () => void;
}) {
  return (
    <>
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
            onNavigate();
          }}
        />
      ))}
    </>
  );
}

function StudentSidebarNav({
  primary,
  more,
  userName,
  logoHref,
}: {
  primary: NavItem[];
  more: NavItem[];
  userName: string;
  logoHref: string;
}) {
  const { open, setOpen } = useSidebar();
  const moreActive = more.some((item) => item.current);
  const [moreOpen, setMoreOpen] = useState(moreActive);

  useEffect(() => {
    if (moreActive) setMoreOpen(true);
  }, [moreActive]);

  return (
    <>
      <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <SidebarLogo href={logoHref} />
        <div className="mt-8 flex flex-col gap-2">
          <NavLinks items={primary} onNavigate={() => setOpen(false)} />
          <button
            type="button"
            className="acet-more-trigger flex items-center justify-start gap-2 py-2 text-left"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((v) => !v)}
            title="Yana"
          >
            <ChevronDown
              className={`text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0 transition-transform duration-300 ${moreOpen ? "rotate-180" : ""}`}
            />
            {open ? (
              <span className="text-neutral-700 dark:text-neutral-200 text-sm whitespace-pre">Yana</span>
            ) : null}
          </button>
          <SoftExpand open={moreOpen}>
            <div className="flex flex-col gap-2 pb-1">
              <NavLinks items={more} onNavigate={() => setOpen(false)} />
            </div>
          </SoftExpand>
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

function SidebarNav({
  items,
  userName,
  logoHref,
}: {
  items: NavItem[];
  userName: string;
  logoHref: string;
}) {
  const { setOpen } = useSidebar();
  return (
    <>
      <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <SidebarLogo href={logoHref} />
        <div className="mt-8 flex flex-col gap-2">
          <NavLinks items={items} onNavigate={() => setOpen(false)} />
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
  const logoHref = isTeacherRole(userRole) ? "/teacher" : isAdminRole(userRole) ? "/admin" : "/app";
  const isStudent = !isTeacherRole(userRole) && !isAdminRole(userRole);
  const student = useMemo(
    () => (isStudent ? studentNav({ active, userRole, tariffTier }) : null),
    [active, isStudent, tariffTier, userRole],
  );
  const items = linksFor({ active, userRole, tariffTier });

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
        {student ? (
          <StudentSidebarNav
            primary={student.primary}
            more={student.more}
            userName={displayName}
            logoHref={logoHref}
          />
        ) : (
          <SidebarNav items={items} userName={displayName} logoHref={logoHref} />
        )}
      </DesktopSidebar>
      <MobileSidebar className="justify-between gap-10">
        {student ? (
          <StudentSidebarNav
            primary={student.primary}
            more={student.more}
            userName={displayName}
            logoHref={logoHref}
          />
        ) : (
          <SidebarNav items={items} userName={displayName} logoHref={logoHref} />
        )}
      </MobileSidebar>
    </SidebarProvider>
  );
}
