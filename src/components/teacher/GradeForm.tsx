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
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/teacher/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, grade: Number(grade), teacherNote: note }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Baho saqlanmadi");
        return;
      }
      router.refresh();
    } catch {
      setError("Tarmoq xatosi — qayta urinib ko‘ring");
    } finally {
      setBusy(false);
    }
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
      <button className="btn btn-sm" type="submit" disabled={busy}>
        {busy ? "Saqlanmoqda..." : "Saqlash"}
      </button>
      {error ? <p className="small" style={{ color: "var(--danger)", width: "100%", margin: 0 }}>{error}</p> : null}
    </form>
  );
}
