"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { localInputToIso } from "@/lib/utils";

export function CreateAssignmentForm({ courses }: { courses: { id: string; titleUz: string }[] }) {
  const router = useRouter();
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [titleUz, setTitleUz] = useState("");
  const [descriptionUz, setDescriptionUz] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/teacher/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, titleUz, descriptionUz, dueAt: localInputToIso(dueAt) }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Topshiriq saqlanmadi");
        return;
      }
      setTitleUz("");
      setDescriptionUz("");
      router.refresh();
    } catch {
      setError("Tarmoq xatosi — qayta urinib ko‘ring");
    } finally {
      setBusy(false);
    }
  };

  if (!courses.length) return null;

  return (
    <form onSubmit={submit} className="card" style={{ marginBottom: 20 }}>
      <div className="field">
        <label>Kurs</label>
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.titleUz}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Sarlavha</label>
        <input value={titleUz} onChange={(e) => setTitleUz(e.target.value)} required />
      </div>
      <div className="field">
        <label>Tavsif</label>
        <textarea value={descriptionUz} onChange={(e) => setDescriptionUz(e.target.value)} required />
      </div>
      <div className="field">
        <label>Muddat</label>
        <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} required />
      </div>
      {error ? <p className="small" style={{ color: "var(--danger)" }}>{error}</p> : null}
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? "Saqlanmoqda..." : "Qo\u2018shish"}
      </button>
    </form>
  );
}
