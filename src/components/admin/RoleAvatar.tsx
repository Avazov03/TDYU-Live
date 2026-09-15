"use client";

import { GraduationCap, Presentation, Shield } from "lucide-react";

type RoleKind = "student" | "teacher" | "admin";

/** Classic profile silhouette (head + shoulders), no initials. */
function UserSilhouette({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden fill="currentColor">
      <circle cx="20" cy="14" r="7.5" />
      <path d="M6.5 34.5c1.8-8.2 7.2-12 13.5-12s11.7 3.8 13.5 12" />
    </svg>
  );
}

export function RoleAvatar({
  name,
  role,
  size = "sm",
}: {
  name: string;
  role: RoleKind;
  size?: "sm" | "md";
}) {
  const BadgeIcon = role === "teacher" ? Presentation : role === "admin" ? Shield : GraduationCap;
  const label = role === "teacher" ? "O'qituvchi" : role === "admin" ? "Admin" : "O'quvchi";

  return (
    <span
      className={`role-avatar role-${role} size-${size}`}
      title={`${name} · ${label}`}
      aria-label={`${name}, ${label}`}
    >
      <UserSilhouette className="role-avatar-face" />
      <span className="role-avatar-badge" aria-hidden>
        <BadgeIcon size={size === "sm" ? 10 : 12} strokeWidth={2.4} />
      </span>
    </span>
  );
}
