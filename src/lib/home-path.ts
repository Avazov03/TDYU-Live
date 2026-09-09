import { auth } from "@/lib/auth";
import { isAdminRole, isTeacherRole } from "@/lib/roles";

/** Login/register dan keyin: admin/o'qituvchi kabinet, talaba — sayt landingi. */
export async function resolveHomePath() {
  const session = await auth();
  if (!session?.user?.id) return "/";
  if (isAdminRole(session.user.role)) return "/admin";
  if (isTeacherRole(session.user.role)) return "/teacher";
  return "/";
}
