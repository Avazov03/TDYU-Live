import type { UserRole } from "@/generated/prisma/client";

export function isAdminRole(role: string | UserRole | undefined) {
  return role === "admin";
}

export function isTeacherRole(role: string | UserRole | undefined) {
  return role === "teacher";
}

export function isStudentRole(role: string | UserRole | undefined) {
  return role === "student";
}

export type RoleKind = "student" | "teacher" | "admin";

export const ROLE_LABELS: Record<RoleKind, string> = {
  student: "O‘quvchi",
  teacher: "O‘qituvchi",
  admin: "Admin",
};

export function roleKind(role: string | UserRole | undefined): RoleKind {
  if (isAdminRole(role)) return "admin";
  if (isTeacherRole(role)) return "teacher";
  return "student";
}
