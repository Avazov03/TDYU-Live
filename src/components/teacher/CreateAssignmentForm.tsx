"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateAssignmentForm({ courses }: { courses: { id: string; titleUz: string }[] }) {
  const router = useRouter();
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [titleUz, setTitleUz] = useState("");
  const [descriptionUz, setDescriptionUz] = useState("");
  const [dueAt, setDueAt] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/teacher/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, titleUz, descriptionUz, dueAt }),
    });
    setTitleUz("");
    setDescriptionUz("");
    router.refresh();
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
      <button className="btn btn-primary" type="submit">Qo&apos;shish</button>
    </form>
  );
}
