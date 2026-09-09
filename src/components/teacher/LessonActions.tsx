"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MUX_RTMP_URL } from "@/lib/mux-player";

export function LessonActions({
  lessonId,
  status,
  streamKey,
}: {
  lessonId: string;
  status: string;
  streamKey?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const realKey = streamKey && !streamKey.startsWith("demo_") ? streamKey : null;

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
        <button className="btn btn-danger btn-sm" type="button" disabled={loading} onClick={() => act("end")}>
          Efirni tugatish
        </button>
      ) : null}
      {status === "live" && realKey ? (
        <div className="small muted" style={{ marginTop: 8 }}>
          <div>OBS Server: {MUX_RTMP_URL}</div>
          <div>Stream key: {realKey}</div>
        </div>
      ) : null}
      {status === "live" && streamKey && !realKey ? (
        <p className="small" style={{ color: "var(--danger)", marginTop: 8 }}>
          Mux kaliti yo&apos;q — demo efir. Haqiqiy OBS ishlamaydi.
        </p>
      ) : null}
      {error ? <p className="small" style={{ color: "var(--danger)" }}>{error}</p> : null}
    </div>
  );
}
