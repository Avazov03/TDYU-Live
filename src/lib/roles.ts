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
