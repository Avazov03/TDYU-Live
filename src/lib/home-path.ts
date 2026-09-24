import { auth } from "@/lib/auth";
import { isAdminRole, isTeacherRole } from "@/lib/roles";
import {
  getActiveEntitlement,
  getAnyActiveSubscription,
  getAnyOpenEnrollment,
  resolveStudentHomePath,
} from "@/lib/access";
import { getEnrollmentAccessMode } from "@/lib/feature-flags";

/** Login/register dan keyin: admin/o'qituvchi kabinet, talaba — Enrollment yoki V1 onboard. */
export async function resolveHomePath() {
  const session = await auth();
  if (!session?.user?.id) return "/";
  if (isAdminRole(session.user.role)) return "/admin";
  if (isTeacherRole(session.user.role)) return "/teacher";

  const mode = getEnrollmentAccessMode();
  const enr =
    mode === "enrollment" || mode === "dual"
      ? await getAnyOpenEnrollment(session.user.id)
      : null;
  const sub =
    mode === "enrollment"
      ? null
      : await getAnyActiveSubscription(session.user.id);
  const entitlement = await getActiveEntitlement(session.user.id);

  return resolveStudentHomePath({
    mode,
    hasOpenEnrollment: Boolean(enr),
    hasActiveSubscription: Boolean(sub),
    hasActiveEntitlement: Boolean(entitlement),
  });
}
