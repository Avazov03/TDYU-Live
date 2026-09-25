"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  lessonId: string;
  status: string;
};

/** Minimal teacher publish control — no redesign. */
export function RecordingPublishButton({ lessonId, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const canPublish = status === "ready" || status === "teacher_review";

  if (!canPublish) return null;

  return (
    <div className="row gap-8" style={{ marginTop: 8 }}>
      <button
        type="button"
        className="btn btn-primary"
        data-testid="recording-publish"
        disabled={loading}
        onClick={() => {
          void (async () => {
            setLoading(true);
            setError("");
            const res = await fetch(`/api/teacher/lessons/${lessonId}/recording/publish`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "publish" }),
            });
            const data = await res.json().catch(() => ({}));
            setLoading(false);
            if (!res.ok) {
              setError(typeof data.error === "string" ? data.error : "Xatolik");
              return;
            }
            router.refresh();
          })();
        }}
      >
        {loading ? "Chop etilmoqda..." : "Yozuvni chop etish"}
      </button>
      {error ? <span className="muted small">{error}</span> : null}
    </div>
  );
}
