import type { TariffTier } from "@/generated/prisma/client";

export const TARIFF_LABELS: Record<TariffTier, string> = {
  t1: "1-tarif — Yozuv",
  t2: "2-tarif — Jonli",
  t3: "3-tarif — Premium",
};

export const TARIFF_FEATURES: Record<TariffTier, string[]> = {
  t1: ["Yozib olingan darslar"],
  t2: ["Yozib olingan darslar", "Jonli efir", "Efirda savol berish"],
  t3: [
    "Yozib olingan darslar",
    "Jonli efir",
    "Efirda savol berish",
    "Topshiriqni birinchi navbatda tekshirish",
    "Chatda ustuvor belgi",
  ],
};

export const TARIFF_APP_HINTS: Record<TariffTier, string> = {
  t1: "Yozuvlar ochiq. Jonli efir, Shorts va chat 2-tarifdan.",
  t2: "Jonli efir, Shorts va chat ochiq.",
  t3: "Premium: ustuvor chat va topshiriqlar birinchi navbatda tekshiriladi.",
};

export function canWatchLive(tier: TariffTier | null | undefined) {
  return tier === "t2" || tier === "t3";
}

export function canUseLiveChat(tier: TariffTier | null | undefined) {
  return tier === "t2" || tier === "t3";
}

export function isPriorityTier(tier: TariffTier | null | undefined) {
  return tier === "t3";
}

export function formatSom(amount: number) {
  return `${amount.toLocaleString("uz-UZ")} so'm`;
}

export function isSubscriptionActive(endsAt: Date, now = new Date()) {
  return endsAt.getTime() > now.getTime();
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
