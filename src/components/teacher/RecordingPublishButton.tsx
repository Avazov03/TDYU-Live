"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

type Props = {
  lessonId: string;
  status: string;
};

/** Teacher publish control; publishing needs explicit confirmation (students are notified). */
export function RecordingPublishButton({ lessonId, status }: Props) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const canPublish = status === "ready" || status === "teacher_review";

  if (!canPublish) return null;

  const close = () => ref.current?.close();

  const publish = async () => {
    if (loading) return;
    setLoading(true);
    setError("");
    const res = await fetch(`/api/teacher/lessons/${lessonId}/recording/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "publish" }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setLoading(false);
    if (!res || !res.ok) {
      setError(typeof data.error === "string" ? data.error : "Xatolik");
      return;
    }
    close();
    router.refresh();
  };

  return (
    <div className="row gap-8" style={{ marginTop: 8 }}>
      <button
        type="button"
        className="btn btn-primary"
        data-testid="recording-publish"
        onClick={() => {
          setError("");
          ref.current?.showModal();
        }}
      >
        Yozuvni chop etish
      </button>
      <dialog ref={ref} className="lx-dialog" aria-labelledby={`rec-pub-${lessonId}`}>
        <div className="lx-dialog-head">
          <h2 id={`rec-pub-${lessonId}`}>Yozuvni chop etish</h2>
          <button type="button" className="iconbtn" onClick={close} aria-label="Yopish">
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="lx-dialog-body">
          <p>Chop etilgach o‘quvchilar yozuvni ko‘radi va bildirishnoma oladi. Davom etasizmi?</p>
          {error ? (
            <p className="lx-field-err" role="alert">
              {error}
            </p>
          ) : null}
          <div className="lx-dialog-actions">
            <button type="button" className="btn" onClick={close}>
              Bekor qilish
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading}
              onClick={() => void publish()}
              data-testid="recording-publish-confirm"
            >
              {loading ? "Chop etilmoqda..." : "Chop etish"}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
