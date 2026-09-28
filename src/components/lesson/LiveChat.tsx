"use client";

import { useEffect, useState } from "react";
import { initials } from "@/lib/utils";

const COMMENTS_POLL_MS = 15_000;

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
    let denied = false;
    const tick = () => {
      if (denied || document.hidden) return;
      fetch(`/api/lessons/${lessonId}/chat`)
        .then((r) => {
          if (r.status === 401 || r.status === 403 || r.status === 404) denied = true;
          return r.ok ? r.json() : { items: [] };
        })
        .then((data) => {
          if (!cancelled) setItems(data.items ?? []);
        })
        .catch(() => undefined);
    };
    const t = setInterval(tick, COMMENTS_POLL_MS);
    const start = setTimeout(tick, 0);
    document.addEventListener("visibilitychange", tick);
    return () => {
      cancelled = true;
      clearInterval(t);
      clearTimeout(start);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [lessonId]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/lessons/${lessonId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.item) {
        setText("");
        setItems((prev) => [...prev, data.item]);
      }
    } catch {
      // keep the typed text so the user can retry
    } finally {
      setSending(false);
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
