"use client";

import Link from "next/link";

/** Flag-gated CTA → Checkout V2 (course purchase, not tariff). */
export function CheckoutV2Button({
  courseId,
  label,
  className,
}: {
  courseId: string;
  label: string;
  className?: string;
}) {
  return (
    <div className="lx-ace-cta-wrap">
      <Link
        href={`/checkout/v2?courseId=${encodeURIComponent(courseId)}`}
        className={className || "btn btn-primary"}
        data-testid="checkout-v2-cta"
      >
        {label}
      </Link>
    </div>
  );
}
