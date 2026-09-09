"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { isAdminRole, isTeacherRole } from "@/lib/roles";

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
  tariffTier?: string | null;
};

export function Sidebar({ active = "home", userRole, tariffTier }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const handler = () => setCollapsed((v) => !v);
    window.addEventListener("toggle-sidebar", handler);
    return () => window.removeEventListener("toggle-sidebar", handler);
  }, []);

  const isHome = active === "home" || active === "catalog";
  const isSubs = active === "playlists" || active === "my-courses";
  const shortsLocked = tariffTier === "t1";

  if (isTeacherRole(userRole)) {
    return (
      <div className={`sidebar${collapsed ? " collapsed" : ""}`} id="sidebar">
        <Link href="/teacher" className={`navitem${active === "teacher" ? " active" : ""}`}>
          <Icon name="play" />
          <span className="navlabel">Darslarim</span>
        </Link>
        <Link href="/teacher/group" className={`navitem${active === "teacher-group" ? " active" : ""}`}>
          <Icon name="users" />
          <span className="navlabel">Guruh</span>
        </Link>
        <Link href="/teacher/assignments" className={`navitem${active === "teacher-assignments" ? " active" : ""}`}>
          <Icon name="list" />
          <span className="navlabel">Topshiriqlar</span>
        </Link>
        <hr />
        <Link href="/" className="navitem">
          <Icon name="home" />
          <span className="navlabel">Bosh sahifa</span>
        </Link>
      </div>
    );
  }

  if (isAdminRole(userRole)) {
    return (
      <div className={`sidebar${collapsed ? " collapsed" : ""}`} id="sidebar">
        <Link href="/admin" className={`navitem${active === "admin" ? " active" : ""}`}>
          <Icon name="settings" />
          <span className="navlabel">Studio</span>
        </Link>
        <Link href="/" className="navitem">
          <Icon name="home" />
          <span className="navlabel">Bosh sahifa</span>
        </Link>
      </div>
    );
  }

  return (
    <div className={`sidebar${collapsed ? " collapsed" : ""}`} id="sidebar">
      <Link href="/app" className={`navitem${isHome ? " active" : ""}`}>
        <Icon name="home" />
        <span className="navlabel">Asosiy</span>
      </Link>
      <Link
        href="/shorts"
        className={`navitem${active === "shorts" ? " active" : ""}${shortsLocked ? " locked" : ""}`}
        title={shortsLocked ? "Jonli efir 2 va 3-tarifda" : undefined}
      >
        <Icon name="shorts" />
        <span className="navlabel">Shorts</span>
      </Link>
      <hr />
      <div className="sec-title">Siz</div>
      <Link href="/my-courses" className={`navitem${isSubs ? " active" : ""}`}>
        <Icon name="play" />
        <span className="navlabel">Obunalar</span>
      </Link>
      <Link href="/history" className={`navitem${active === "history" ? " active" : ""}`}>
        <Icon name="history" />
        <span className="navlabel">Tarix</span>
      </Link>
      <Link href="/schedule" className={`navitem${active === "schedule" ? " active" : ""}`}>
        <Icon name="clock" />
        <span className="navlabel">Jadval</span>
      </Link>
      <Link href="/assignments" className={`navitem${active === "assignments" ? " active" : ""}`}>
        <Icon name="list" />
        <span className="navlabel">Topshiriqlar</span>
      </Link>
      <Link href="/certificates" className={`navitem${active === "certificates" ? " active" : ""}`}>
        <Icon name="bookmark" />
        <span className="navlabel">Sertifikatlar</span>
      </Link>
      <hr />
      <Link href="/" className="navitem">
        <Icon name="home" />
        <span className="navlabel">Bosh sahifa</span>
      </Link>
    </div>
  );
}
