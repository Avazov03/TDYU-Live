"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function QuickLiveButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const go = async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/teacher/lessons/quick-live", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Efir ochilmadi");
      return;
    }
    router.refresh();
    window.location.hash = "live";
  };

  return (
    <div>
      <button type="button" className="btn btn-primary" disabled={loading} onClick={() => void go()}>
        {loading ? "Tayyorlanmoqda..." : "Hozir efir"}
      </button>
      {error ? <p className="small" style={{ color: "var(--danger)", marginTop: 8 }}>{error}</p> : null}
    </div>
  );
}
