import { redirect } from "next/navigation";
import type { LessonStatus, TariffTier } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import {
  compareAccessOutcomes,
  getEnrollmentLessonAccess,
  logAccessEnrollmentDecision,
  logAccessShadowCompare,
  type EnrollmentAccessResult,
} from "@/lib/enrollment-access";
import {
  getEnrollmentAccessMode,
  usesEnrollmentAccessPath,
} from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";
import { isAdminRole, isStudentRole, isTeacherRole } from "@/lib/roles";
import { canWatchLive, isSubscriptionActive } from "@/lib/tariffs";

export type AccessResult =
  | { ok: true; tier: TariffTier }
  | { ok: false; reason: "unauthenticated" | "no_subscription" | "expired" | "live_locked" | "not_started" };

/** Any open Enrollment seat — cabinet gate when Enrollment path is active. */
export async function getAnyOpenEnrollment(userId: string) {
  return prisma.enrollment.findFirst({
    where: {
      userId,
      accessOpen: true,
      status: { in: ["active", "completed"] },
    },
    select: { id: true, courseId: true, status: true, accessOpen: true },
  });
}

/** Talaba LMS sahifalari: kirish + faol tarif yoki ochiq Enrollment. */
export async function requireStudentCabinet(callbackUrl: string) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  if (isAdminRole(session.user.role)) redirect("/admin");
  if (isTeacherRole(session.user.role)) redirect("/teacher");

  const sub = await getAnyActiveSubscription(session.user.id);
  if (sub) return { user: session.user, sub };

  if (usesEnrollmentAccessPath()) {
    const enr = await getAnyOpenEnrollment(session.user.id);
    if (enr) return { user: session.user, sub: null };
  }

  const entitlement = await getActiveEntitlement(session.user.id);
  if (entitlement) redirect("/onboard");
  redirect("/#tariflar");
}

/** Dashboard ichidagi umumiy sahifa (qidiruv, tarix): talabaga tarif/enrollment kerak. */
export async function requireAppUser(callbackUrl: string) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  if (isStudentRole(session.user.role)) {
    const sub = await getAnyActiveSubscription(session.user.id);
    if (sub) return { user: session.user, sub };
    if (usesEnrollmentAccessPath()) {
      const enr = await getAnyOpenEnrollment(session.user.id);
      if (enr) return { user: session.user, sub: null };
    }
    const entitlement = await getActiveEntitlement(session.user.id);
    if (entitlement) redirect("/onboard");
    redirect("/#tariflar");
  }
  return { user: session.user, sub: null };
}

export async function getActiveEntitlement(userId: string) {
  const row = await prisma.entitlement.findUnique({ where: { userId } });
  if (!row || !isSubscriptionActive(row.endsAt)) return null;
  return row;
}

export async function getActiveSubscriptions(userId: string) {
  const subs = await prisma.subscription.findMany({
    where: { userId },
    include: {
      course: {
        select: {
          id: true,
          titleUz: true,
          descriptionUz: true,
          isPublished: true,
          teacherId: true,
          teacher: { select: { id: true, fullName: true } },
          subject: { select: { nameUz: true } },
          faculty: { select: { nameUz: true } },
        },
      },
    },
    orderBy: { endsAt: "desc" },
  });
  return subs.filter((s) => isSubscriptionActive(s.endsAt));
}

export async function getAnyActiveSubscription(userId: string) {
  const subs = await prisma.subscription.findMany({
    where: { userId },
    include: {
      course: {
        select: {
          id: true,
          titleUz: true,
          isPublished: true,
          teacherId: true,
          teacher: { select: { id: true, fullName: true } },
        },
      },
    },
    orderBy: { endsAt: "desc" },
  });
  return subs.find((s) => isSubscriptionActive(s.endsAt)) ?? null;
}

export async function getActiveSubscription(userId: string, courseId: string) {
  const sub = await prisma.subscription.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (!sub) return null;
  if (!isSubscriptionActive(sub.endsAt)) return null;
  return sub;
}

/** Open Enrollment seat for (userId, courseId) — Checkout V2 / dual / enrollment SoT. */
export async function getOpenEnrollment(userId: string, courseId: string) {
  const rows = await prisma.enrollment.findMany({
    where: { userId, courseId },
    select: {
      id: true,
      status: true,
      accessOpen: true,
      purchaseId: true,
      activatedAt: true,
    },
  });
  return (
    rows.find(
      (e) =>
        e.accessOpen && (e.status === "active" || e.status === "completed"),
    ) ?? null
  );
}

/**
 * Course-scoped content gate (assignments, materials) — uses lesson access SoT
 * with status "ended" so seat rules apply without requiring a live lesson.
 */
export async function hasCourseContentAccess(
  userId: string,
  courseId: string,
): Promise<boolean> {
  const access = await getLessonAccess(userId, courseId, "ended");
  return access.ok;
}

/** Wave 1 alias — authoritative course seat check (Enrollment when mode=enrollment). */
export async function canUserAccessCourse(
  userId: string,
  courseId: string,
): Promise<boolean> {
  return hasCourseContentAccess(userId, courseId);
}

/** Wave 1 alias — loads lesson then applies getLessonAccess (server-side only). */
export async function canUserAccessLesson(
  userId: string,
  lessonId: string,
): Promise<boolean> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { courseId: true, status: true },
  });
  if (!lesson) return false;
  const access = await getLessonAccess(userId, lesson.courseId, lesson.status);
  return access.ok;
}

/** Legacy Subscription + endsAt + tier (CURRENT SoT when mode=off|shadow). */
export async function getLegacyLessonAccess(
  userId: string | undefined,
  courseId: string,
  status: LessonStatus,
): Promise<AccessResult> {
  if (!userId) return { ok: false, reason: "unauthenticated" };

  const sub = await prisma.subscription.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (!sub) return { ok: false, reason: "no_subscription" };
  if (!isSubscriptionActive(sub.endsAt)) return { ok: false, reason: "expired" };

  if (status === "scheduled") return { ok: false, reason: "not_started" };
  if ((status === "live" || status === "lobby") && !canWatchLive(sub.tier)) {
    return { ok: false, reason: "live_locked" };
  }

  return { ok: true, tier: sub.tier };
}

function enrollmentToLegacyShape(
  neu: EnrollmentAccessResult,
  fallbackTier: TariffTier,
): AccessResult {
  if (neu.ok) return { ok: true, tier: fallbackTier };
  switch (neu.reason) {
    case "unauthenticated":
      return { ok: false, reason: "unauthenticated" };
    case "no_enrollment":
      return { ok: false, reason: "no_subscription" };
    case "access_closed":
    case "inactive":
      return { ok: false, reason: "expired" };
    case "not_started":
      return { ok: false, reason: "not_started" };
    case "live_locked":
      return { ok: false, reason: "live_locked" };
    default:
      return { ok: false, reason: "no_subscription" };
  }
}

/**
 * Lesson access authority entry.
 *
 * Modes (FF_ENROLLMENT_ACCESS_MODE):
 * - off (default): legacy only
 * - shadow: serve legacy; compare enrollment path; log MATCH/MISMATCH
 * - dual: Enrollment when present+open, else legacy fallback
 * - enrollment: Enrollment sole SoT (no Subscription allow path)
 *
 * Never expires other courses. Never trusts client-supplied userId as auth.
 * Callers must pass session-derived userId.
 */
export async function getLessonAccess(
  userId: string | undefined,
  courseId: string,
  status: LessonStatus,
): Promise<AccessResult> {
  const mode = getEnrollmentAccessMode();
  const legacy = await getLegacyLessonAccess(userId, courseId, status);

  if (mode === "off") {
    return legacy;
  }

  let legacyTier: TariffTier | null = legacy.ok ? legacy.tier : null;
  if (!legacyTier && userId) {
    const sub = await prisma.subscription.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { tier: true },
    });
    legacyTier = sub?.tier ?? null;
  }

  const applyLegacyLiveTier = mode !== "enrollment";
  const neu = await getEnrollmentLessonAccess(userId, courseId, status, {
    // enrollment mode: seat access is not tariff-gated (permanent replay / V2).
    applyLegacyLiveTier,
    legacyTier,
  });

  if (mode === "shadow" && userId) {
    const verdict = compareAccessOutcomes(legacy.ok, neu.ok);
    logAccessShadowCompare({
      userId,
      courseId,
      lessonStatus: status,
      old: legacy,
      neu,
      verdict,
    });
    return legacy;
  }

  if (mode === "enrollment") {
    const shaped = enrollmentToLegacyShape(neu, legacyTier ?? "t2");
    if (userId) {
      logAccessEnrollmentDecision({
        userId,
        courseId,
        lessonStatus: status,
        decision: shaped.ok ? "allow" : "deny",
        enrollmentId: neu.ok ? neu.enrollmentId : undefined,
        enrollmentStatus: neu.ok ? neu.status : undefined,
        accessOpen: neu.ok ? true : undefined,
        reason: neu.ok ? undefined : neu.reason,
      });
    }
    return shaped;
  }

  // dual: prefer enrollment seat when it yields a decisive enrollment row.
  // If no enrollment → legacy fallback (do not invent allow).
  if (mode === "dual") {
    if (neu.ok || neu.reason !== "no_enrollment") {
      return enrollmentToLegacyShape(neu, legacyTier ?? "t1");
    }
    return legacy;
  }

  return legacy;
}

export function accessMessage(
  reason: "unauthenticated" | "no_subscription" | "expired" | "live_locked" | "not_started",
) {
  switch (reason) {
    case "unauthenticated":
      return "Darsni ko'rish uchun tizimga kiring.";
    case "no_subscription":
      return "Bu o'qituvchi kursiga yozilmagansiz. Avval yo'nalish va o'qituvchini tanlang.";
    case "expired":
      return "Obuna muddati tugagan. Qayta to'lov qiling.";
    case "live_locked":
      return "Jonli efir 2 va 3-tarifda. Yozuv tugagach 1-tarifda ham ochiladi.";
    case "not_started":
      return "Dars hali boshlanmagan.";
  }
}
