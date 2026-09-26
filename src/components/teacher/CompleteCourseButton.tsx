"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CompleteCourseButton({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const complete = async () => {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/teacher/courses/${courseId}/complete`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Kurs yakunlanmadi");
      setConfirming(false);
      return;
    }
    router.refresh();
  };

  return (
    <div data-testid="course-complete" style={{ width: "100%" }}>
      {confirming ? (
        <div className="teacher-course-next" role="group" aria-label="Kursni yakunlash">
          <p className="small" style={{ margin: "0 0 8px" }}>
            Kurs yakunlanadi: o‘quvchilar kurs tarixiga o‘tadi, yozuvlar ular uchun doimiy ochiq qoladi.
          </p>
          <div className="row gap-8" style={{ flexWrap: "wrap" }}>
            <button className="btn btn-primary btn-sm" type="button" disabled={busy} onClick={() => void complete()}>
              Ha, yakunlash
            </button>
            <button className="btn btn-sm" type="button" disabled={busy} onClick={() => setConfirming(false)}>
              Bekor
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn-sm" type="button" onClick={() => setConfirming(true)}>
          Kursni yakunlash
        </button>
      )}
      {error ? (
        <p className="small" role="alert" style={{ color: "var(--danger)", marginTop: 8 }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
