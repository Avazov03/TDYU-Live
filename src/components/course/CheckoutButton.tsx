"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const pay = async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/payments/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(courseId ? { courseId } : {}), tier }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; next?: string };
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "To'lov amalga oshmadi");
      if (res.status === 401) router.push("/login?callbackUrl=/#tariflar");
      return;
    }
    router.refresh();
    router.push(data.next === "onboard" ? "/onboard" : "/app");
  };

  return (
    <div className="lx-ace-cta-wrap">
      <button
        type="button"
        className={className || "btn btn-primary"}
        onClick={pay}
        disabled={loading}
      >
        {loading ? "To'lanmoqda..." : label}
      </button>
      {error ? <div className="small" style={{ color: "var(--danger)", marginTop: 8 }}>{error}</div> : null}
    </div>
  );
}
