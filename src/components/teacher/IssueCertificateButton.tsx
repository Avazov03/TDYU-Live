"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { CERTIFICATE_MAX_BYTES, isLowAttendance } from "@/lib/certificate-policy";

export function IssueCertificateButton({
  courseId,
  userId,
  studentName,
  attended,
  lessonCount,
  assignmentsDone,
  assignmentsTotal,
  reissue = false,
}: {
  courseId: string;
  userId: string;
  studentName: string;
  attended: number;
  lessonCount: number;
  assignmentsDone: number;
  assignmentsTotal: number;
  reissue?: boolean;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const low = isLowAttendance(attended, lessonCount);

  const open = () => {
    setFile(null);
    setError("");
    ref.current?.showModal();
  };
  const close = () => ref.current?.close();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!file) return setError("Sertifikat faylini tanlang");
    if (file.size > CERTIFICATE_MAX_BYTES) return setError("Fayl 10 MB dan oshmasin");
    setBusy(true);
    setError("");
    const body = new FormData();
    body.set("courseId", courseId);
    body.set("userId", userId);
    body.set("file", file);
    const res = await fetch("/api/teacher/certificates", { method: "POST", body }).catch(() => null);
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
      <button className="btn btn-sm" type="button" onClick={open} data-testid="certificate-issue">
        {reissue ? "Qayta berish" : "Sertifikat berish"}
      </button>
      <dialog ref={ref} className="lx-dialog" aria-labelledby={`cert-${userId}-title`}>
        <div className="lx-dialog-head">
          <h2 id={`cert-${userId}-title`}>Sertifikat — {studentName}</h2>
          <button type="button" className="iconbtn" onClick={close} aria-label="Yopish">
            <X size={18} aria-hidden />
          </button>
        </div>
        <form className="lx-dialog-body soft-form" onSubmit={submit} noValidate>
          <dl className="lx-cert-facts">
            <div>
              <dt>Davomat</dt>
              <dd>
                {attended}/{lessonCount}
              </dd>
            </div>
            <div>
              <dt>Topshiriqlar</dt>
              <dd>{assignmentsTotal ? `${assignmentsDone}/${assignmentsTotal}` : "Berilmagan"}</dd>
            </div>
          </dl>
          {low ? (
            <p className="lx-cert-warn" role="alert" data-testid="certificate-low-attendance">
              Davomat {attended}/{lessonCount} — baribir berasizmi? Qaror sizda.
            </p>
          ) : null}
          <div className="field">
            <label htmlFor={`cert-${userId}-file`}>Sertifikat fayli (PDF, JPG yoki PNG, 10 MB gacha)</label>
            <input
              id={`cert-${userId}-file`}
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setError("");
              }}
            />
          </div>
          {error ? (
            <p className="lx-field-err" role="alert">
              {error}
            </p>
          ) : null}
          <div className="lx-dialog-actions">
            <button type="button" className="btn" onClick={close}>
              Bekor qilish
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy} data-testid="certificate-confirm">
              {busy ? "Yuklanmoqda…" : "Tasdiqlash"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
