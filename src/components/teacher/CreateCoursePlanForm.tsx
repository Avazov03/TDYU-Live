"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function defaultSlot() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`;
}

/** Yangi kurs (umumiy mavzu) + birinchi dars yoki N ta dars shabloni. */
export function CreateCoursePlanForm() {
  const router = useRouter();
  const [titleUz, setTitleUz] = useState("");
  const [descriptionUz, setDescriptionUz] = useState("");
  const [lessonCount, setLessonCount] = useState(7);
  const [firstAt, setFirstAt] = useState(defaultSlot);
  const [intervalDays, setIntervalDays] = useState(2);
  const [firstTitle, setFirstTitle] = useState("1-dars");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/teacher/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titleUz,
        descriptionUz,
        lessonCount,
        firstAt,
        intervalDays,
        firstTitle,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Saqlanmadi");
      return;
    }
    setTitleUz("");
    setDescriptionUz("");
    setFirstTitle("1-dars");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="card" style={{ marginBottom: 8 }}>
      <p className="small muted" style={{ marginBottom: 12 }}>
        Umumiy kurs mavzusini kiriting — rejasiga dars qatorlari qo‘shiladi. Studio’da kartochka ko‘rinadi.
      </p>
      <div className="field">
        <label>Kurs / umumiy mavzu</label>
        <input value={titleUz} onChange={(e) => setTitleUz(e.target.value)} required minLength={2} />
      </div>
      <div className="field">
        <label>Qisqa tavsif</label>
        <textarea value={descriptionUz} onChange={(e) => setDescriptionUz(e.target.value)} rows={2} maxLength={800} />
      </div>
      <div className="row gap-12" style={{ flexWrap: "wrap" }}>
        <div className="field" style={{ flex: 1, minWidth: 120 }}>
          <label>Nechta jonli dars</label>
          <input
            type="number"
            min={1}
            max={40}
            value={lessonCount}
            onChange={(e) => setLessonCount(Number(e.target.value) || 1)}
          />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 120 }}>
          <label>Oraliq (kun)</label>
          <input
            type="number"
            min={1}
            max={30}
            value={intervalDays}
            onChange={(e) => setIntervalDays(Number(e.target.value) || 1)}
          />
        </div>
      </div>
      <div className="field">
        <label>Birinchi dars vaqti</label>
        <input type="datetime-local" value={firstAt} onChange={(e) => setFirstAt(e.target.value)} required />
      </div>
      <div className="field">
        <label>Birinchi dars nomi</label>
        <input value={firstTitle} onChange={(e) => setFirstTitle(e.target.value)} required />
      </div>
      {error ? <p className="small" style={{ color: "var(--danger)" }}>{error}</p> : null}
      <button className="btn btn-primary" type="submit" disabled={loading}>
        {loading ? "Yaratilmoqda..." : "Kursni rejasiga qo‘shish"}
      </button>
    </form>
  );
}
