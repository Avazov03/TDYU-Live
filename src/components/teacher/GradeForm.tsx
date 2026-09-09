"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GradeForm({
  submissionId,
  initialGrade,
  initialNote,
}: {
  submissionId: string;
  initialGrade: number | null;
  initialNote: string | null;
}) {
  const router = useRouter();
  const [grade, setGrade] = useState(initialGrade?.toString() ?? "");
  const [note, setNote] = useState(initialNote ?? "");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/teacher/grades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId, grade: Number(grade), teacherNote: note }),
    });
    router.refresh();
  };

  return (
    <form onSubmit={save} className="row gap-8" style={{ marginTop: 8, flexWrap: "wrap" }}>
      <input
        type="number"
        min={0}
        max={100}
        value={grade}
        onChange={(e) => setGrade(e.target.value)}
        placeholder="Baho"
        style={{ width: 90 }}
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Izoh"
        style={{ flex: 1, minWidth: 160 }}
      />
      <button className="btn btn-sm" type="submit">Saqlash</button>
    </form>
  );
}
