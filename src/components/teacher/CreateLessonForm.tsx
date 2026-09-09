"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function defaultSlot() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}

export function CreateLessonForm({ courses }: { courses: { id: string; titleUz: string }[] }) {
  const router = useRouter();
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [titleUz, setTitleUz] = useState("");
  const [scheduledAt, setScheduledAt] = useState(defaultSlot);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/teacher/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, titleUz, scheduledAt }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Saqlanmadi");
      return;
    }
    setTitleUz("");
    setScheduledAt(defaultSlot());
    router.refresh();
  };

  if (courses.length === 0) return null;

  return (
    <form id="reja" onSubmit={submit} className="card" style={{ marginBottom: 20 }}>
      <h3 style={{ marginBottom: 6 }}>Darsni rejalash</h3>
      <p className="small muted" style={{ marginBottom: 12 }}>
        Mavzu va vaqtni belgilang. Efirni yuqoridagi Studio&apos;dan boshlaysiz.
      </p>
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
        <label>Sana va vaqt</label>
        <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} required />
      </div>
      {error ? <p className="small" style={{ color: "var(--danger)" }}>{error}</p> : null}
      <button className="btn btn-primary" type="submit">Jadvalga qo&apos;shish</button>
    </form>
  );
}
