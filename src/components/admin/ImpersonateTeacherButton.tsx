"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export function ImpersonateTeacherButton({ teacherId }: { teacherId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const go = async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacherId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setLoading(false);
      setError(data.error || "Kirib bo'lmadi");
      return;
    }
    const signed = await signIn("credentials", { ticket: data.ticket, redirect: false });
    setLoading(false);
    if (signed?.error) {
      setError("Kirish amalga oshmadi");
      return;
    }
    router.push("/teacher");
    router.refresh();
  };

  return (
    <div>
      <button type="button" className="btn btn-sm btn-primary" disabled={loading} onClick={go}>
        {loading ? "..." : "Kabinetga kirish"}
      </button>
      {error ? <div className="small" style={{ color: "var(--danger)", marginTop: 4 }}>{error}</div> : null}
    </div>
  );
}
