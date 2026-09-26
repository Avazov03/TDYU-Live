"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CancelCourseButton({ courseId, buyers }: { courseId: string; buyers: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const cancel = async () => {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/teacher/courses/${courseId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Kurs bekor qilinmadi");
      return;
    }
    router.refresh();
  };

  return (
    <div data-testid="course-cancel" style={{ width: "100%" }}>
      {open ? (
        <form
          className="teacher-course-next"
          onSubmit={(e) => {
            e.preventDefault();
            void cancel();
          }}
        >
          <p className="small" style={{ margin: "0 0 8px" }}>
            Kurs boshlanmagan — bekor qilinsa {buyers > 0 ? `${buyers} ta xaridorga` : "xaridorlarga"} to‘lov
            100% qaytariladi, darslar o‘chiriladi.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Sabab — o‘quvchilarga yuboriladi"
            aria-label="Bekor qilish sababi"
            style={{ width: "100%" }}
          />
          <div className="row gap-8" style={{ flexWrap: "wrap", marginTop: 8 }}>
            <button className="btn btn-primary btn-sm" type="submit" disabled={busy}>
              Ha, bekor qilish
            </button>
            <button className="btn btn-sm" type="button" disabled={busy} onClick={() => setOpen(false)}>
              Yopish
            </button>
          </div>
        </form>
      ) : (
        <button className="btn btn-sm" type="button" onClick={() => setOpen(true)}>
          Kursni bekor qilish
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
