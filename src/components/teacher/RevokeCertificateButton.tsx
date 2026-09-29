"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { checkRevokeReason } from "@/lib/certificate-policy";

export function RevokeCertificateButton({ certificateId, studentName }: { certificateId: string; studentName: string }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const open = () => {
    setReason("");
    setError("");
    ref.current?.showModal();
  };
  const close = () => ref.current?.close();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const check = checkRevokeReason(reason);
    if (!check.ok) return setError(check.message);
    setBusy(true);
    setError("");
    const res = await fetch(`/api/teacher/certificates/${certificateId}/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: check.reason }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res || !res.ok) {
      setError(data.error || "Tarmoq xatosi — qayta urinib ko‘ring");
      return;
    }
    close();
    router.refresh();
  };

  return (
    <>
      <button className="btn btn-sm" type="button" onClick={open} data-testid="certificate-revoke">
        Bekor qilish
      </button>
      <dialog ref={ref} className="lx-dialog lx-confirm" aria-labelledby={`revoke-${certificateId}-title`}>
        <div className="lx-dialog-head">
          <h2 id={`revoke-${certificateId}-title`}>Sertifikatni bekor qilish — {studentName}</h2>
          <button type="button" className="iconbtn" onClick={close} aria-label="Yopish">
            <X size={18} aria-hidden />
          </button>
        </div>
        <form className="lx-dialog-body soft-form" onSubmit={submit} noValidate>
          <p className="lx-dialog-note">
            O‘quvchi sertifikatni ko‘ra olmaydi va unga xabar boradi. Admin tarixida sabab bilan saqlanadi.
          </p>
          <div className="field">
            <label htmlFor={`revoke-${certificateId}-reason`}>Sabab</label>
            <textarea
              id={`revoke-${certificateId}-reason`}
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError("");
              }}
              placeholder="Masalan: noto‘g‘ri o‘quvchiga berilgan"
            />
          </div>
          {error ? (
            <p className="lx-field-err" role="alert">
              {error}
            </p>
          ) : null}
          <div className="lx-dialog-actions">
            <button type="button" className="btn" onClick={close} autoFocus>
              Yopish
            </button>
            <button type="submit" className="btn btn-danger" disabled={busy} data-testid="certificate-revoke-confirm">
              {busy ? "Saqlanmoqda…" : "Bekor qilish"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
