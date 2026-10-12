"use client";

import { useId, useState } from "react";

export function QuickLiveButton({
  courseId,
  label = "Hozir efir",
}: {
  courseId?: string;
  label?: string;
} = {}) {
  const fid = useId();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const go = async () => {
    if (loading) return;
    setLoading(true);
    setError("");
    let data: {
      error?: string;
      lesson?: { id?: string };
      notified?: { students: number; telegram: number };
    } = {};
    let ok = false;
    try {
      const res = await fetch("/api/teacher/lessons/quick-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(courseId ? { courseId, titleUz: topic.trim() } : {}),
      });
      ok = res.ok;
      data = await res.json().catch(() => ({}));
    } catch {
      setLoading(false);
      setError("Tarmoq xatosi — qayta urinib ko‘ring");
      return;
    }
    if (!ok) {
      setLoading(false);
      setError(data.error || "Efir ochilmadi");
      return;
    }
    const id = data.lesson?.id;
    if (!id) {
      setLoading(false);
      setError("Dars ID topilmadi");
      return;
    }
    const sent = data.notified ? `?xabar=${data.notified.students}&tg=${data.notified.telegram}` : "";
    window.location.href = `/teacher/live/${id}${sent}`;
  };

  const errorLine = error ? (
    <p className="small" role="alert" style={{ color: "var(--danger)", margin: 0, flexBasis: "100%" }}>
      {error}
    </p>
  ) : null;

  if (courseId && open) {
    return (
      <form
        className="lx-quick-live"
        data-testid="quick-live-form"
        onSubmit={(e) => {
          e.preventDefault();
          void go();
        }}
      >
        <label htmlFor={`${fid}-topic`}>Bugungi mavzu</label>
        <input
          id={`${fid}-topic`}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          maxLength={120}
          placeholder="Masalan: Jinoyat tarkibi (ixtiyoriy)"
          autoFocus
        />
        <p className="small muted">
          Kutish xonasi ochiladi va talabalarga xabar boradi. Efir «Jonli efirni boshlash»ni bosganingizda
          boshlanadi.
        </p>
        <div className="lx-quick-live-actions">
          <button type="submit" className="btn btn-primary" disabled={loading} data-testid="quick-live-open">
            {loading ? "Ochilmoqda..." : "Kutish xonasini ochish"}
          </button>
          <button
            type="button"
            className="btn"
            disabled={loading}
            onClick={() => {
              setOpen(false);
              setError("");
            }}
          >
            Bekor
          </button>
        </div>
        {errorLine}
      </form>
    );
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-primary"
        disabled={loading}
        onClick={() => (courseId ? setOpen(true) : void go())}
        data-testid="quick-live"
      >
        {loading ? "Tayyorlanmoqda..." : label}
      </button>
      {errorLine}
    </>
  );
}
