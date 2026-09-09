"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function IssueCertificateButton({ courseId, userId }: { courseId: string; userId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const issue = async () => {
    setLoading(true);
    await fetch("/api/teacher/certificates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, userId }),
    });
    setLoading(false);
    router.refresh();
  };

  return (
    <button className="btn btn-sm btn-primary" type="button" disabled={loading} onClick={issue}>
      Sertifikat berish
    </button>
  );
}
