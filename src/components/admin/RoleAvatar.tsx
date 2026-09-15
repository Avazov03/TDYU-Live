"use client";

import { GraduationCap, Presentation } from "lucide-react";
import { initials } from "@/lib/utils";

type RoleKind = "student" | "teacher" | "admin";

export function RoleAvatar({
  name,
  role,
  size = "sm",
}: {
  name: string;
  role: RoleKind;
  size?: "sm" | "md";
}) {
  const Icon = role === "teacher" ? Presentation : GraduationCap;
  return (
    <span className={`role-avatar role-${role} size-${size}`} title={role === "teacher" ? "O'qituvchi" : role === "admin" ? "Admin" : "O'quvchi"}>
      <span className="role-avatar-initials" aria-hidden>{initials(name)}</span>
      <span className="role-avatar-badge" aria-hidden>
        <Icon size={size === "sm" ? 10 : 12} strokeWidth={2.4} />
      </span>
    </span>
  );
}
