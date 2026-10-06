"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmAction } from "@/components/ui/ConfirmDialog";

type Ticket = { id: string; subject: string; body: string; status: string; createdAt: string };
type Refundable = { id: string; title: string; amount: number };

export function SupportDesk({ tickets, refundable }: { tickets: Ticket[]; refundable: Refundable[] }) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");

  const send = async () => {
    setBusy(true);
    setError("");
    const res = await fetch("/api/support/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Yuborilmadi");
      return;
    }
    setSubject("");
    setBody("");
    router.refresh();
  };

  const refund = async (item: Refundable) => {
    if (busy) return;
    const ok = await confirmAction({
      title: "To‘lovni qaytarasizmi?",
      message: `«${item.title}» uchun ${item.amount} so‘m to‘liq qaytariladi va kursga kirish yopiladi.`,
      confirmLabel: "100% qaytarish",
    });
    if (!ok) return;
    const purchaseId = item.id;
    setBusy(true);
    setError("");
    setDone("");
    const res = await fetch("/api/student/refunds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purchaseId }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Qaytarilmadi");
      return;
    }
    setDone(`«${item.title}» uchun to‘lov qaytarildi. Kursga kirish yopildi.`);
    router.refresh();
  };

  return (
    <main className="lx-section" style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1>Yordam</h1>
      <p className="small muted">Sayt xabari asosiy. Telefon va Telegram qo‘shimcha.</p>
      {error ? (
        <p className="small" role="alert">
          {error}
        </p>
      ) : null}
      {done ? (
        <p className="small" role="status" data-testid="refund-success">
          {done}
        </p>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <div className="field">
          <label htmlFor="support-subject">Mavzu</label>
          <input id="support-subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="support-body">Xabar</label>
          <textarea id="support-body" value={body} onChange={(e) => setBody(e.target.value)} required rows={5} />
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Yuborilmoqda..." : "Yuborish"}
        </button>
      </form>
      {refundable.length > 0 ? (
        <section style={{ marginTop: 28 }}>
          <h2>Boshlanmagan kursni qaytarish</h2>
          <ul>
            {refundable.map((item) => (
              <li key={item.id} style={{ marginBottom: 8 }}>
                {item.title} — {item.amount} so‘m{" "}
                <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void refund(item)}
                  data-testid="refund-before-start"
                >
                  100% qaytarish
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section style={{ marginTop: 28 }}>
        <h2>So‘rovlar</h2>
        {tickets.length === 0 ? <p className="small muted">Hali so‘rov yo‘q.</p> : null}
        <ul>
          {tickets.map((t) => (
            <li key={t.id} style={{ marginBottom: 12 }}>
              <strong>{t.subject}</strong> · {t.status}
              <p className="small">{t.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
