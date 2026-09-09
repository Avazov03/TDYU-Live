"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export function StopImpersonateButton() {
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
    <button type="button" className="btn btn-sm btn-primary" disabled={loading} onClick={back}>
      {loading ? "..." : "Admin'ga qaytish"}
    </button>
  );
}
