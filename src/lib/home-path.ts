import { auth } from "@/lib/auth";
import { isAdminRole, isTeacherRole } from "@/lib/roles";
import { getActiveEntitlement, getAnyActiveSubscription } from "@/lib/access";

/** Login/register dan keyin: admin/o'qituvchi kabinet, talaba — tarif yoki o'qituvchi tanlash. */
export async function resolveHomePath() {
  const session = await auth();
  if (!session?.user?.id) return "/";
  if (isAdminRole(session.user.role)) return "/admin";
  if (isTeacherRole(session.user.role)) return "/teacher";
  const sub = await getAnyActiveSubscription(session.user.id);
  if (sub) return "/app";
  const entitlement = await getActiveEntitlement(session.user.id);
  if (entitlement) return "/onboard";
  return "/";
}
