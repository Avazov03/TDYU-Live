import { redirect } from "next/navigation";
import type { LessonStatus, TariffTier } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole, isStudentRole, isTeacherRole } from "@/lib/roles";
import { canWatchLive, isSubscriptionActive } from "@/lib/tariffs";

export type AccessResult =
  | { ok: true; tier: TariffTier }
  | { ok: false; reason: "unauthenticated" | "no_subscription" | "expired" | "live_locked" | "not_started" };

/** Talaba LMS sahifalari: kirish + faol tarif. Boshqa rollar o‘z kabinetiga. */
export async function requireStudentCabinet(callbackUrl: string) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  if (isAdminRole(session.user.role)) redirect("/admin");
  if (isTeacherRole(session.user.role)) redirect("/teacher");

  const sub = await getAnyActiveSubscription(session.user.id);
  if (sub) return { user: session.user, sub };
  const entitlement = await getActiveEntitlement(session.user.id);
  if (entitlement) redirect("/onboard");
  redirect("/#tariflar");
}

/** Dashboard ichidagi umumiy sahifa (qidiruv, tarix): talabaga tarif kerak. */
export async function requireAppUser(callbackUrl: string) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  if (isStudentRole(session.user.role)) {
    const sub = await getAnyActiveSubscription(session.user.id);
    if (sub) return { user: session.user, sub };
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

export async function getLessonAccess(
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
