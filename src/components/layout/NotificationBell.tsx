"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

type Item = {
  id: string;
  titleUz: string;
  messageUz: string;
  isRead: boolean;
  createdAt: string;
};

export function NotificationBell({ unreadCount }: { unreadCount: number }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(unreadCount);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => setItems(data.items ?? []))
      .catch(() => undefined);
  }, [open]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const markAll = async () => {
    await fetch("/api/notifications", { method: "PATCH" });
    setUnread(0);
    setItems((prev) => prev.map((i) => ({ ...i, isRead: true })));
  };

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button
        className="iconbtn"
        type="button"
        aria-label="Bildirishnomalar"
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="bell" />
        {unread > 0 ? <span className="badge-dot" /> : null}
      </button>
      {open ? (
        <div className="dropdown open" style={{ width: 340 }}>
          <div className="ddx-item" style={{ justifyContent: "space-between" }}>
            <b>Bildirishnomalar</b>
            {unread > 0 ? (
              <button type="button" className="btn btn-sm" onClick={markAll}>
                O&apos;qildi
              </button>
            ) : null}
          </div>
          <div className="ddx-divider" />
          {items.length === 0 ? (
            <div className="ddx-item muted">Hozircha xabar yo&apos;q</div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="ddx-item" style={{ alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: item.isRead ? 400 : 600 }}>{item.titleUz}</div>
                  <div className="small muted">{item.messageUz}</div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
