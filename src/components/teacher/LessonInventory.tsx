"use client";

import { useEffect, useState } from "react";

export type LessonFile = {
  id: string;
  fileName: string;
  fileUrl: string;
  mime: string;
};

type LessonInventoryProps = {
  lessonId: string;
  canPresent?: boolean;
  onPresent?: (file: LessonFile) => void;
};

export function LessonInventory({ lessonId, canPresent, onPresent }: LessonInventoryProps) {
  const [items, setItems] = useState<LessonFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const res = await fetch(`/api/teacher/lessons/${lessonId}/assets`);
      const data = await res.json().catch(() => ({}));
      if (!cancelled) setItems(data.items ?? []);
    };
    void refresh();
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  const load = async () => {
    const res = await fetch(`/api/teacher/lessons/${lessonId}/assets`);
    const data = await res.json().catch(() => ({}));
    setItems(data.items ?? []);
  };

  const upload = async (file: File) => {
    setBusy(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/teacher/lessons/${lessonId}/assets`, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Yuklanmadi");
      return;
    }
    await load();
  };

  const remove = async (id: string) => {
    setBusy(true);
    await fetch(`/api/teacher/lessons/${lessonId}/assets/${id}`, { method: "DELETE" });
    setBusy(false);
    await load();
  };

  return (
    <div className="lesson-inventory">
      <div className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ fontSize: 15, margin: 0 }}>Dars fayllari</h3>
          <p className="small muted" style={{ margin: "4px 0 0" }}>
            Slayd, PDF yoki rasmni oldindan saqlang. Efirda «Namoyish» bosing — asosiy ekranni egallaydi.
          </p>
        </div>
        <label className={`btn btn-sm${busy ? " is-busy" : ""}`}>
          {busy ? "Yuklanmoqda..." : "Fayl qo‘shish"}
          <input
            type="file"
            hidden
            accept="image/*,video/*,.pdf,.ppt,.pptx,.doc,.docx"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {error ? <p className="small" style={{ color: "var(--danger)", marginTop: 8 }}>{error}</p> : null}
      {items.length === 0 ? (
        <p className="small muted" style={{ marginTop: 10 }}>Hali fayl yo‘q.</p>
      ) : (
        <ul className="lesson-inventory-list">
          {items.map((item) => (
            <li key={item.id}>
              <a href={item.fileUrl} target="_blank" rel="noreferrer">
                {item.fileName}
              </a>
              <span className="row gap-8">
                {canPresent && onPresent ? (
                  <button className="btn btn-sm btn-primary" type="button" onClick={() => onPresent(item)}>
                    Namoyish
                  </button>
                ) : null}
                <button className="btn btn-sm" type="button" onClick={() => void remove(item.id)}>
                  O‘chirish
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
