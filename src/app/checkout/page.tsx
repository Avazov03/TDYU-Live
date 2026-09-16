import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CheckoutClient } from "@/components/course/CheckoutClient";
import { PLATFORM_PRICES } from "@/lib/tariffs";
import { prisma } from "@/lib/prisma";
import type { TariffTier } from "@/generated/prisma/client";

function isTier(v: string | undefined): v is TariffTier {
  return v === "t1" || v === "t2" || v === "t3";
}

type Props = {
  searchParams: Promise<{ tier?: string; courseId?: string }>;
};

export default async function CheckoutPage({ searchParams }: Props) {
  const session = await auth();
  const sp = await searchParams;
  const tier = isTier(sp.tier) ? sp.tier : "t2";
  const courseId = sp.courseId?.trim() || undefined;

  const callback = `/checkout?tier=${tier}${courseId ? `&courseId=${courseId}` : ""}`;
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callback)}`);
  }

  let price = PLATFORM_PRICES[tier];
  if (courseId) {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course || !course.isPublished) redirect("/#tariflar");
    price = tier === "t1" ? course.priceT1 : tier === "t2" ? course.priceT2 : course.priceT3;
  }

  return <CheckoutClient tier={tier} price={price} courseId={courseId} />;
}
