"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { localInputToIso, tashkentParts } from "@/lib/utils";

function toLocalInput(isoOrDate: string | Date) {
  const p = tashkentParts(typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate);
  return `${p.year}-${String(p.monthIndex + 1).padStart(2, "0")}-${p.day}T${p.hour}:${p.minute}`;
}

export function EditLessonPanel({
  lessonId,
  status,
  titleUz,
  summaryUz,
  coverUrl,
  scheduledAt,
  overdue = false,
}: {
  lessonId: string;
  status: string;
  titleUz: string;
  summaryUz?: string | null;
  coverUrl?: string | null;
  scheduledAt: string;
  /** Never started and its slot is over — the dialog opens as "pick a new time". */
  overdue?: boolean;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const [title, setTitle] = useState(titleUz);
  const [summary, setSummary] = useState(summaryUz ?? "");
  const [cover, setCover] = useState(coverUrl ?? "");
  const [when, setWhen] = useState(toLocalInput(scheduledAt));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rowError, setRowError] = useState("");

  if (status === "live" || status === "lobby") return null;

  const open = () => {
    setTitle(titleUz);
    setSummary(summaryUz ?? "");
    setCover(coverUrl ?? "");
    setWhen(toLocalInput(scheduledAt));
    setError("");
    setRowError("");
    ref.current?.showModal();
  };
  const close = () => ref.current?.close();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const body: Record<string, string> = {
      titleUz: title,
      summaryUz: summary,
      coverUrl: cover,
    };
    if (status === "scheduled") body.scheduledAt = localInputToIso(when);

    const res = await fetch(`/api/teacher/lessons/${lessonId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res || !res.ok) {
      setError(data.error || "Saqlanmadi — qayta urinib ko‘ring");
      return;
    }
    close();
    router.refresh();
  };

  const remove = async () => {
    const ok = await confirmAction({
      title: "Darsni o‘chirasizmi?",
      message: `«${titleUz}» rejadan olib tashlanadi. Bu amalni qaytarib bo‘lmaydi.`,
      confirmLabel: "O‘chirish",
    });
    if (!ok) return;
    setBusy(true);
    setRowError("");
    const res = await fetch(`/api/teacher/lessons/${lessonId}`, { method: "DELETE" }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res || !res.ok) {
      setRowError(data.error || "O‘chirilmadi");
      return;
    }
    router.refresh();
  };

  const titleId = `${uid}-title`;

  return (
    <>
      <div className="row gap-8" style={{ flexWrap: "wrap" }}>
        <button type="button" className={overdue ? "btn btn-sm btn-primary" : "btn btn-sm"} onClick={open}>
          {overdue ? "Qayta rejalash" : "Tahrirlash"}
        </button>
        {status === "scheduled" ? (
          <button type="button" className="btn btn-sm btn-danger" disabled={busy} onClick={() => void remove()}>
            O‘chirish
          </button>
        ) : null}
        {rowError ? (
          <p className="small" role="alert" style={{ color: "var(--danger)", margin: 0, flexBasis: "100%" }}>
            {rowError}
          </p>
        ) : null}
      </div>

      <dialog ref={ref} className="lx-dialog" aria-labelledby={titleId}>
        <div className="lx-dialog-head">
          <h2 id={titleId}>{overdue ? "Qayta rejalash" : "Darsni tahrirlash"}</h2>
          <button type="button" className="iconbtn" onClick={close} aria-label="Yopish">
            <X size={18} aria-hidden />
          </button>
        </div>
        <form onSubmit={save} className="lx-dialog-body soft-form">
          {overdue ? (
            <p className="lx-dialog-note">
              Bu dars belgilangan vaqtda o‘tkazilmadi. Yangi vaqt tanlang — o‘quvchilarga xabar boradi.
            </p>
          ) : null}
          <div className="field">
            <label htmlFor={`${uid}-t`}>Mavzu</label>
            <input id={`${uid}-t`} value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} />
          </div>
          {status === "scheduled" ? (
            <div className="field">
              <label htmlFor={`${uid}-w`}>Sana va vaqt</label>
              <input
                id={`${uid}-w`}
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                required
              />
            </div>
          ) : null}
          <div className="field">
            <label htmlFor={`${uid}-s`}>Qisqa ma&apos;lumot</label>
            <textarea
              id={`${uid}-s`}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Darsda nima o‘tiladi"
            />
          </div>
          <div className="field">
            <label htmlFor={`${uid}-c`}>Banner URL</label>
            <input id={`${uid}-c`} value={cover} onChange={(e) => setCover(e.target.value)} placeholder="https://" />
          </div>
          {error ? (
            <p className="lx-field-err" role="alert">
              {error}
            </p>
          ) : null}
          <div className="lx-dialog-actions">
            <button type="button" className="btn" onClick={close}>
              Bekor qilish
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Saqlanmoqda…" : "Saqlash"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
