"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatSom } from "@/lib/tariffs";

export type AdminRefundInfo =
  | { kind: "refunded"; type: "full_100" | "half_50" | "course_cancel_100"; amount: number }
  | { kind: "eligible"; purchaseId: string; amount: number; progressPercent: number }
  | { kind: "blocked"; note: string };

const REFUND_TYPE_LABEL = {
  full_100: "100% qaytarilgan",
  course_cancel_100: "Kurs bekor — 100% qaytarilgan",
  half_50: "50% qaytarilgan",
} as const;

export function AdminRefundCell({ info }: { info: AdminRefundInfo }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (info.kind === "refunded") {
    return (
      <div data-testid="refund-done">
        <span className="badge pending">{REFUND_TYPE_LABEL[info.type]}</span>
        <div className="small muted">{formatSom(info.amount)}</div>
      </div>
    );
  }
  if (info.kind === "blocked") {
    return <span className="small muted">{info.note}</span>;
  }

  const submit = async () => {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/admin/purchases/${info.purchaseId}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Qaytarilmadi");
      return;
    }
    setOpen(false);
    router.refresh();
  };

  return (
    <div data-testid="refund-eligible" style={{ minWidth: 180 }}>
      {open ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <p className="small muted" style={{ margin: "0 0 6px" }}>
            O‘tilgan: {info.progressPercent}% · qaytariladi {formatSom(info.amount)}. Kursga kirish yopiladi.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Asos (masalan: o‘quvchi kasal bo‘lib qoldi, hujjat bor)"
            aria-label="Qaytarish asosi"
            style={{ width: "100%" }}
          />
          <div className="row gap-8" style={{ marginTop: 6, flexWrap: "wrap" }}>
            <button className="btn btn-primary btn-sm" type="submit" disabled={busy}>
              50% qaytarish
            </button>
            <button className="btn btn-sm" type="button" disabled={busy} onClick={() => setOpen(false)}>
              Bekor
            </button>
          </div>
        </form>
      ) : (
        <button className="btn btn-sm" type="button" onClick={() => setOpen(true)}>
          50% qaytarish
        </button>
      )}
      {error ? (
        <p className="small" role="alert" style={{ color: "var(--danger)", margin: "6px 0 0" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
