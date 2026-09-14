import { prisma } from "@/lib/prisma";

const DEFAULT_SUPER_ADMIN_EMAIL = "avazov@tdyu.live";

export function superAdminEmails() {
  const fromEnv = (process.env.SUPER_ADMIN_EMAIL ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : [DEFAULT_SUPER_ADMIN_EMAIL];
}

export function isSuperAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  return superAdminEmails().includes(email.toLowerCase());
}

export async function viewerCanSeeCredentials(
  userId: string | undefined,
  role: string | undefined,
) {
  if (!userId || role !== "admin") return false;
  const viewer = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true },
  });
  if (!viewer || viewer.role !== "admin") return false;
  return isSuperAdminEmail(viewer.email);
}
