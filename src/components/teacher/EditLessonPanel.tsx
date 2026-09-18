"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function toLocalInput(isoOrDate: string | Date) {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EditLessonPanel({
  lessonId,
  status,
  titleUz,
  summaryUz,
  coverUrl,
  scheduledAt,
}: {
  lessonId: string;
  status: string;
  titleUz: string;
  summaryUz?: string | null;
  coverUrl?: string | null;
  scheduledAt: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(titleUz);
  const [summary, setSummary] = useState(summaryUz ?? "");
  const [cover, setCover] = useState(coverUrl ?? "");
  const [when, setWhen] = useState(toLocalInput(scheduledAt));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (status === "live" || status === "lobby") return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body: Record<string, string> = {
      titleUz: title,
      summaryUz: summary,
      coverUrl: cover,
    };
    if (status === "scheduled") body.scheduledAt = when;

    const res = await fetch(`/api/teacher/lessons/${lessonId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Saqlanmadi");
      return;
    }
    setOpen(false);
    router.refresh();
  };

  const remove = async () => {
    if (!window.confirm("Bu darsni rejadan o‘chirasizmi?")) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/teacher/lessons/${lessonId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "O'chirilmadi");
      return;
    }
    router.refresh();
  };

  if (!open) {
    return (
      <div className="row gap-8" style={{ flexWrap: "wrap" }}>
        <button type="button" className="btn btn-sm" onClick={() => setOpen(true)}>
          Tahrirlash
        </button>
        {status === "scheduled" ? (
          <button type="button" className="btn btn-sm btn-danger" disabled={busy} onClick={() => void remove()}>
            O‘chirish
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={save} className="soft-form" style={{ marginTop: 10, width: "100%" }}>
      <div className="field">
        <label>Mavzu</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="field">
        <label>Qisqa ma&apos;lumot</label>
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={500} rows={2} />
      </div>
      <div className="field">
        <label>Banner URL</label>
        <input value={cover} onChange={(e) => setCover(e.target.value)} placeholder="https://" />
      </div>
      {status === "scheduled" ? (
        <div className="field">
          <label>Sana va vaqt</label>
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />
        </div>
      ) : null}
      {error ? <p className="small" style={{ color: "var(--danger)" }}>{error}</p> : null}
      <div className="row gap-8">
        <button className="btn btn-sm btn-primary" type="submit" disabled={busy}>
          Saqlash
        </button>
        <button type="button" className="btn btn-sm" onClick={() => setOpen(false)}>
          Bekor
        </button>
      </div>
    </form>
  );
}
