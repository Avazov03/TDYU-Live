"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmAction } from "@/components/ui/ConfirmDialog";

export function CourseLifecycleActions({
  courseId,
  activeStudents,
  canUnpublish,
}: {
  courseId: string;
  activeStudents: number;
  canUnpublish: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [teachers, setTeachers] = useState<{ id: string; fullName: string }[] | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [teacherId, setTeacherId] = useState("");
  const [done, setDone] = useState("");

  async function unpublish() {
    if (busy) return;
    setError("");
    setDone("");
    if (reason.trim().length < 5) {
      setError("Sababni yozing (kamida 5 belgi)");
      return;
    }
    const ok = await confirmAction({
      title: "Kursni nashrdan olasizmi?",
      message: `Yangi xarid yopiladi. Hozirgi ${activeStudents} o‘quvchi kirishda qoladi.`,
      confirmLabel: "Nashrdan olish",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unpublish", reason }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Nashrdan olinmadi");
        return;
      }
      setReason("");
      setDone("Kurs sotuvdan olindi. Yozilgan o‘quvchilar darslarini ko‘raveradi.");
      router.refresh();
    } catch {
      setError("Tarmoq xatosi");
    } finally {
      setBusy(false);
    }
  }

  async function loadTeachers() {
    setError("");
    setDone("");
    const res = await fetch(`/api/admin/courses/${courseId}/replace-teacher`);
    const data = (await res.json().catch(() => ({}))) as {
      teachers?: { id: string; fullName: string }[];
      emptyHint?: string | null;
      error?: string;
    };
    if (!res.ok) {
      setError(data.error || "O‘qituvchilar yuklanmadi");
      return;
    }
    setTeachers(data.teachers ?? []);
    setHint(data.emptyHint ?? null);
    setTeacherId(data.teachers?.[0]?.id ?? "");
  }

  async function replace() {
    if (busy || !teacherId) return;
    setError("");
    setDone("");
    const name = teachers?.find((t) => t.id === teacherId)?.fullName ?? "";
    const ok = await confirmAction({
      title: "O‘qituvchini almashtirasizmi?",
      message: `Kurs ${name} ga o‘tadi. O‘quvchilarga xabar yuboriladi.`,
      confirmLabel: "Almashtirish",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/replace-teacher`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Almashtirilmadi");
        return;
      }
      setTeachers(null);
      setDone("O‘qituvchi almashtirildi. O‘quvchilarga xabar yuborildi.");
      router.refresh();
    } catch {
      setError("Tarmoq xatosi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="staff-detail-actions" style={{ marginTop: 12, flexDirection: "column", alignItems: "stretch" }}>
      {canUnpublish ? (
        <div>
          <p className="small muted" style={{ margin: "0 0 8px" }}>
            Nashrdan olinsa yangi xarid yopiladi. Hozirgi o‘quvchilar ({activeStudents}) kirishda qoladi.
          </p>
          <label className="small" htmlFor={`unpub-${courseId}`}>
            Sabab
          </label>
          <textarea
            id={`unpub-${courseId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            style={{ width: "100%", margin: "4px 0 8px" }}
          />
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void unpublish()}>
            {busy ? "Saqlanmoqda..." : "Nashrdan olish"}
          </button>
        </div>
      ) : null}
      <div>
        {teachers == null ? (
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void loadTeachers()}>
            O‘qituvchini almashtirish
          </button>
        ) : (
          <div>
            {hint ? <p className="small muted">{hint}</p> : null}
            {teachers.length > 0 ? (
              <>
                <label className="small" htmlFor={`repl-${courseId}`}>
                  Shu fan bo‘yicha o‘qituvchi
                </label>
                <select
                  id={`repl-${courseId}`}
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  style={{ display: "block", margin: "4px 0 8px" }}
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => void replace()}>
                  {busy ? "Saqlanmoqda..." : "Almashtirish"}
                </button>
              </>
            ) : null}
          </div>
        )}
      </div>
      {done ? (
        <p className="small" role="status">
          {done}
        </p>
      ) : null}
      {error ? (
        <p className="small" role="alert" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
