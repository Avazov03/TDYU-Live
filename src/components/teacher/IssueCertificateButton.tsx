"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function IssueCertificateButton({ courseId, userId }: { courseId: string; userId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const issue = async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/teacher/certificates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, userId }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Sertifikat berilmadi");
      return;
    }
    router.refresh();
  };

  return (
    <>
      <button className="btn btn-sm btn-primary" type="button" disabled={loading} onClick={issue}>
        Sertifikat berish
      </button>
      {error ? (
        <p className="small" role="alert" style={{ color: "var(--danger)", margin: "6px 0 0" }}>
          {error}
        </p>
      ) : null}
    </>
  );
}
