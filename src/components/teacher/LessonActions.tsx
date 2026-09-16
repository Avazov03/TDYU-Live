"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EditLessonPanel } from "@/components/teacher/EditLessonPanel";

export function LessonActions({
  lessonId,
  status,
  titleUz,
  summaryUz,
  coverUrl,
  scheduledAt,
}: {
  lessonId: string;
  status: string;
  streamKey?: string | null;
  titleUz: string;
  summaryUz?: string | null;
  coverUrl?: string | null;
  scheduledAt: string;
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
    <div style={{ display: "grid", gap: 8 }}>
      <div className="row gap-8" style={{ flexWrap: "wrap" }}>
        {status === "scheduled" ? (
          <button className="btn btn-primary btn-sm" type="button" disabled={loading} onClick={() => void act("start")}>
            Efirni boshlash
          </button>
        ) : null}
        {status === "live" ? (
          <a href="/teacher#live" className="btn btn-danger btn-sm">
            Studioda tugating
          </a>
        ) : null}
      </div>
      {status === "live" ? (
        <p className="small muted" style={{ margin: 0 }}>
          Yozuv saqlanishi uchun efirni studio sahifasidan yoping.
        </p>
      ) : null}
      <EditLessonPanel
        lessonId={lessonId}
        status={status}
        titleUz={titleUz}
        summaryUz={summaryUz}
        coverUrl={coverUrl}
        scheduledAt={scheduledAt}
      />
      {error ? <p className="small" style={{ color: "var(--danger)", margin: 0 }}>{error}</p> : null}
    </div>
  );
}
