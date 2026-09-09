"use client";

import { useEffect, useState } from "react";
import { initials } from "@/lib/utils";

type Message = {
  id: string;
  text: string;
  priority: boolean;
  createdAt: string;
  user: { fullName: string };
};

export function LiveChat({ lessonId, canSend }: { lessonId: string; canSend: boolean }) {
  const [items, setItems] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      fetch(`/api/lessons/${lessonId}/chat`)
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((data) => {
          if (!cancelled) setItems(data.items ?? []);
        })
        .catch(() => undefined);
    };
    const t = setInterval(tick, 4000);
    const start = setTimeout(tick, 0);
    return () => {
      cancelled = true;
      clearInterval(t);
      clearTimeout(start);
    };
  }, [lessonId]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    const res = await fetch(`/api/lessons/${lessonId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    setText("");
    setSending(false);
    if (res.ok && data.item) {
      setItems((prev) => [...prev, data.item]);
    }
  };

  return (
    <div className="chat-panel">
      <h3 style={{ fontSize: 16, margin: "0 0 14px" }}>Izohlar</h3>
      {canSend ? (
        <form onSubmit={send} className="comment-item" style={{ marginBottom: 18 }}>
          <span className="avatar sm">S</span>
          <div style={{ flex: 1 }}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Izoh qo'shing..."
              className="comment-input"
            />
            <button className="btn btn-primary btn-sm" type="submit" disabled={sending} style={{ marginTop: 8 }}>
              Yuborish
            </button>
          </div>
        </form>
      ) : (
        <p className="small muted" style={{ marginBottom: 14 }}>
          Chat faqat 2 va 3-tarif uchun.
        </p>
      )}
      <div className="chat-list">
        {items.length === 0 ? (
          <p className="muted small">Hali izoh yo&apos;q.</p>
        ) : (
          items.map((m) => (
            <div key={m.id} className={`comment-item${m.priority ? " priority" : ""}`}>
              <span className="avatar sm">{initials(m.user.fullName)}</span>
              <div>
                <div className="small" style={{ fontWeight: 600 }}>
                  {m.user.fullName}
                  {m.priority ? <span className="badge accent" style={{ marginLeft: 6 }}>3-tarif</span> : null}
                </div>
                <div>{m.text}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
