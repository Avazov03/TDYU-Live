"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SubmitForm({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const body = new FormData();
    body.set("assignmentId", assignmentId);
    body.set("text", text);
    if (file) body.set("file", file);
    const res = await fetch("/api/assignments/submit", { method: "POST", body });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Yuborilmadi");
      return;
    }
    router.refresh();
  };

  return (
    <form onSubmit={submit}>
      <div className="field">
        <label>Matn</label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Javobingiz..." />
      </div>
      <div className="field">
        <label>Fayl (PDF yoki rasm)</label>
        <input
          type="file"
          accept="image/*,.pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>
      {error ? <p className="small" style={{ color: "var(--danger)" }}>{error}</p> : null}
      <button className="btn btn-primary" type="submit" disabled={loading}>
        {loading ? "Yuborilmoqda..." : "Topshirish"}
      </button>
    </form>
  );
}
