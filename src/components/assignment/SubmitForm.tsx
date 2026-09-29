"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SubmitForm({ assignmentId, onCancel }: { assignmentId: string; onCancel?: () => void }) {
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
    try {
      const res = await fetch("/api/assignments/submit", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || (res.status === 413 ? "Fayl juda katta" : "Yuborilmadi"));
        return;
      }
      router.refresh();
    } catch {
      setError("Tarmoq xatosi — qayta urinib ko‘ring");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="lx-as-submit">
      <div className="field">
        <label htmlFor={`answer-${assignmentId}`}>Javobingiz</label>
        <textarea
          id={`answer-${assignmentId}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Javobingizni shu yerga yozing..."
        />
      </div>
      <div className="field">
        <label htmlFor={`file-${assignmentId}`}>Fayl biriktirish (ixtiyoriy · PDF yoki rasm)</label>
        <input
          id={`file-${assignmentId}`}
          type="file"
          accept="image/*,.pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>
      {error ? <p className="small" style={{ color: "var(--danger)" }}>{error}</p> : null}
      <div className="lx-as-submit-row">
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Yuborilmoqda..." : "Topshirish"}
        </button>
        {onCancel ? (
          <button type="button" className="btn" onClick={onCancel} disabled={loading}>
            Bekor qilish
          </button>
        ) : null}
      </div>
    </form>
  );
}
