import { GraduationCap, Presentation, Shield } from "lucide-react";
import { ROLE_LABELS, roleKind } from "@/lib/roles";

export function RoleBadge({ role }: { role: string | undefined }) {
  const kind = roleKind(role);
  const BadgeIcon = kind === "teacher" ? Presentation : kind === "admin" ? Shield : GraduationCap;
  const label = ROLE_LABELS[kind];
  return (
    <span
      className={`role-badge role-${kind}`}
      title={`Siz ${label} sifatida kirgansiz`}
      data-testid="role-badge"
    >
      <BadgeIcon size={14} strokeWidth={2.2} aria-hidden />
      <span className="role-badge-label">{label}</span>
    </span>
  );
}
