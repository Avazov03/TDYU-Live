"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LessonActions({
  lessonId,
  status,
}: {
  lessonId: string;
  status: string;
  streamKey?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const act = async (action: "start" | "end") => {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/teacher/lessons/${lessonId}/${action}`, { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Xatolik");
      return;
    }
    router.refresh();
  };

  return (
    <div>
      {status === "scheduled" ? (
        <button className="btn btn-primary btn-sm" type="button" disabled={loading} onClick={() => act("start")}>
          Efirni boshlash
        </button>
      ) : null}
      {status === "live" ? (
        <a href="/teacher#live" className="btn btn-danger btn-sm">
          Studioda tugating
        </a>
      ) : null}
      {status === "live" ? (
        <p className="small muted" style={{ marginTop: 8 }}>
          Yozuv saqlanishi uchun efirni studio sahifasidan yoping.
        </p>
      ) : null}
      {error ? <p className="small" style={{ color: "var(--danger)" }}>{error}</p> : null}
    </div>
  );
}
