"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

type Props = {
  label?: string;
  className?: string;
};

export function StopImpersonateButton({
  label = "Admin'ga qaytish",
  className = "btn btn-sm btn-primary",
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const back = async () => {
    setLoading(true);
    const res = await fetch("/api/auth/stop-impersonate", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setLoading(false);
      return;
    }
    await signIn("credentials", { ticket: data.ticket, redirect: false });
    router.push("/admin/teachers");
    router.refresh();
  };

  return (
    <button type="button" className={className} disabled={loading} onClick={back}>
      {loading ? "..." : label}
    </button>
  );
}
