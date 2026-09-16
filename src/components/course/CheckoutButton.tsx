"use client";

import Link from "next/link";
import type { TariffTier } from "@/generated/prisma/client";

export function CheckoutButton({
  courseId,
  tier,
  label,
  className,
}: {
  courseId?: string;
  tier: TariffTier;
  label: string;
  className?: string;
}) {
  const href = courseId
    ? `/checkout?tier=${tier}&courseId=${courseId}`
    : `/checkout?tier=${tier}`;

  return (
    <div className="lx-ace-cta-wrap">
      <Link href={href} className={className || "btn btn-primary"}>
        {label}
      </Link>
    </div>
  );
}
