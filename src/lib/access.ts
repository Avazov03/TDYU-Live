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

/** Talaba LMS sahifalari: kirish + ochiq Enrollment (yoki legacy tarif). */
export async function requireStudentCabinet(callbackUrl: string) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  if (isAdminRole(session.user.role)) redirect("/admin");
  if (isTeacherRole(session.user.role)) redirect("/teacher");

  const mode = getEnrollmentAccessMode();
  const enr =
    mode === "enrollment" || mode === "dual"
      ? await getAnyOpenEnrollment(session.user.id)
      : null;
  const sub =
    mode === "enrollment"
      ? null
      : await getAnyActiveSubscription(session.user.id);

  if (
    studentHasCabinetMembership({
      mode,
      hasOpenEnrollment: Boolean(enr),
      hasActiveSubscription: Boolean(sub),
    })
  ) {
    return { user: session.user, sub };
  }

  const entitlement = await getActiveEntitlement(session.user.id);
  if (entitlement) redirect("/onboard");
  redirect("/#tariflar");
}

/** Dashboard ichidagi umumiy sahifa (qidiruv, tarix): talabaga enrollment/tarif kerak. */
export async function requireAppUser(callbackUrl: string) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  if (isStudentRole(session.user.role)) {
    const mode = getEnrollmentAccessMode();
    const enr =
      mode === "enrollment" || mode === "dual"
        ? await getAnyOpenEnrollment(session.user.id)
        : null;
    const sub =
      mode === "enrollment"
        ? null
        : await getAnyActiveSubscription(session.user.id);

    if (
      studentHasCabinetMembership({
        mode,
        hasOpenEnrollment: Boolean(enr),
        hasActiveSubscription: Boolean(sub),
      })
    ) {
      return { user: session.user, sub };
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

const studentCourseSelect = {
  id: true,
  titleUz: true,
  descriptionUz: true,
  isPublished: true,
  teacherId: true,
  teacher: { select: { id: true, fullName: true } },
  subject: { select: { nameUz: true } },
  faculty: { select: { nameUz: true } },
} as const;

export type StudentOwnedCourse = {
  courseId: string;
  enrollmentId: string | null;
  status: "active" | "completed" | "legacy_subscription";
  accessOpen: boolean;
  /** Legacy display hint only — not used for ownership in enrollment mode. */
  tier: TariffTier;
  course: {
    id: string;
    titleUz: string;
    descriptionUz: string | null;
    isPublished: boolean;
    teacherId: string;
    teacher: { id: string; fullName: string };
    subject: { nameUz: string };
    faculty: { nameUz: string };
  };
};

/**
 * Pure ownership merge for Wave 2 listing (testable without DB).
 *
 * - enrollment: Enrollment seats only (Subscription alone never owns)
 * - dual: Enrollment ∪ active Subscription (dedupe by courseId; Enrollment wins)
 * - off|shadow: active Subscription only
 */
export function mergeStudentOwnedCourseIds(input: {
  mode: ReturnType<typeof getEnrollmentAccessMode>;
  enrollmentCourseIds: string[];
  activeSubscriptionCourseIds: string[];
}): string[] {
  const { mode, enrollmentCourseIds, activeSubscriptionCourseIds } = input;
  if (mode === "enrollment") {
    return [...new Set(enrollmentCourseIds)];
  }
  if (mode === "dual") {
    return [...new Set([...enrollmentCourseIds, ...activeSubscriptionCourseIds])];
  }
  return [...new Set(activeSubscriptionCourseIds)];
}

/** Open Enrollment seats with course payload (active|completed + accessOpen). */
export async function getOpenEnrollmentsWithCourses(userId: string) {
  return prisma.enrollment.findMany({
    where: {
      userId,
      accessOpen: true,
      status: { in: ["active", "completed"] },
    },
    include: { course: { select: studentCourseSelect } },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Student cabinet course membership for /app, /schedule, /assignments, My Courses.
 * Does not expire other courses. Does not use endsAt for Enrollment seats.
 */
export async function getStudentOwnedCourses(
  userId: string,
): Promise<StudentOwnedCourse[]> {
  const mode = getEnrollmentAccessMode();
  const byCourse = new Map<string, StudentOwnedCourse>();

  if (mode === "enrollment" || mode === "dual") {
    const enrollments = await getOpenEnrollmentsWithCourses(userId);
    for (const enr of enrollments) {
      byCourse.set(enr.courseId, {
        courseId: enr.courseId,
        enrollmentId: enr.id,
        status: enr.status === "completed" ? "completed" : "active",
        accessOpen: enr.accessOpen,
        tier: "t2",
        course: enr.course,
      });
    }
  }

  if (mode === "off" || mode === "shadow" || mode === "dual") {
    const subs = await getActiveSubscriptions(userId);
    for (const sub of subs) {
      if (mode === "dual" && byCourse.has(sub.course.id)) continue;
      byCourse.set(sub.course.id, {
        courseId: sub.course.id,
        enrollmentId: null,
        status: "legacy_subscription",
        accessOpen: true,
        tier: sub.tier,
        course: sub.course,
      });
    }
  }

  return [...byCourse.values()];
}

export async function getStudentOwnedCourseIds(userId: string): Promise<string[]> {
  const owned = await getStudentOwnedCourses(userId);
  return owned.map((o) => o.courseId);
}

/** Course detail "owned" badge — Enrollment-only when mode=enrollment. */
export function isStudentCourseOwned(input: {
  mode: ReturnType<typeof getEnrollmentAccessMode>;
  hasOpenEnrollment: boolean;
  hasActiveSubscription: boolean;
}): boolean {
  const { mode, hasOpenEnrollment, hasActiveSubscription } = input;
  if (mode === "enrollment") return hasOpenEnrollment;
  if (mode === "dual") return hasOpenEnrollment || hasActiveSubscription;
  return hasActiveSubscription;
}

/**
 * Wave 3 — does the student have cabinet membership (home /app)?
 * Enrollment mode: open Enrollment only (Subscription alone is not enough).
 * Entitlement alone is NOT cabinet access (that is V1 onboard).
 */
export function studentHasCabinetMembership(input: {
  mode: ReturnType<typeof getEnrollmentAccessMode>;
  hasOpenEnrollment: boolean;
  hasActiveSubscription: boolean;
}): boolean {
  return isStudentCourseOwned(input);
}

export type StudentHomePath = "/app" | "/onboard" | "/";

/**
 * Wave 3 — post-login / landing CTA path for students (pure, testable).
 * Preserves V1 Entitlement → /onboard. Never treats Subscription alone as
 * target ownership when mode=enrollment.
 */
export function resolveStudentHomePath(input: {
  mode: ReturnType<typeof getEnrollmentAccessMode>;
  hasOpenEnrollment: boolean;
  hasActiveSubscription: boolean;
  hasActiveEntitlement: boolean;
}): StudentHomePath {
  const { mode, hasOpenEnrollment, hasActiveSubscription, hasActiveEntitlement } =
    input;
  if (studentHasCabinetMembership({ mode, hasOpenEnrollment, hasActiveSubscription })) {
    return "/app";
  }
  if (hasActiveEntitlement) return "/onboard";
  return "/";
}

/**
 * Sidebar Shorts lock uses legacy TariffTier when mode is off|shadow|dual.
 * Enrollment mode: no Tariff lock (Wave 1 live is Enrollment-gated).
 */
export function resolveStudentShellTariffTier(input: {
  mode: ReturnType<typeof getEnrollmentAccessMode>;
  subscriptionTier: TariffTier | null;
}): TariffTier | null {
  if (input.mode === "enrollment") return null;
  return input.subscriptionTier;
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
