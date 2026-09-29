"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { localInputToIso, nextTashkentHourInput } from "@/lib/utils";

const defaultSlot = () => nextTashkentHourInput();

export function CreateLessonForm({
  courses,
}: {
  courses: { id: string; titleUz: string; needsReview?: boolean }[];
}) {
  const router = useRouter();
  const [done, setDone] = useState<{ courseTitle: string; needsReview: boolean } | null>(null);
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [titleUz, setTitleUz] = useState("");
  const [summaryUz, setSummaryUz] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [scheduledAt, setScheduledAt] = useState(defaultSlot);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError("");
    setDone(null);
    setBusy(true);
    let res: Response;
    let data: { error?: string };
    try {
      res = await fetch("/api/teacher/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          titleUz,
          summaryUz,
          coverUrl,
          scheduledAt: localInputToIso(scheduledAt),
        }),
      });
      data = await res.json().catch(() => ({}));
    } catch {
      setError("Tarmoq xatosi — qayta urinib ko‘ring");
      return;
    } finally {
      setBusy(false);
    }
    if (!res.ok) {
      setError(data.error || "Saqlanmadi");
      return;
    }
    setTitleUz("");
    setSummaryUz("");
    setCoverUrl("");
    setScheduledAt(defaultSlot());
    const course = courses.find((c) => c.id === courseId);
    setDone({ courseTitle: course?.titleUz ?? "", needsReview: Boolean(course?.needsReview) });
    router.refresh();
  };

  if (courses.length === 0) return null;

  return (
    <form id="reja" onSubmit={submit} className="card" style={{ marginBottom: 20 }}>
      <p className="small muted" style={{ marginBottom: 12 }}>
        Qaysi kurs, qachon, nima o&apos;tiladi. Banner ixtiyoriy — bo&apos;lmasa yozuv kadri chiqadi.
      </p>
      <div className="field">
        <label>Kurs</label>
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.titleUz}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Mavzu</label>
        <input value={titleUz} onChange={(e) => setTitleUz(e.target.value)} required />
      </div>
      <div className="field">
        <label>Qisqa ma&apos;lumot</label>
        <textarea value={summaryUz} onChange={(e) => setSummaryUz(e.target.value)} maxLength={500} rows={3} />
      </div>
      <div className="field">
        <label>Banner rasmi (ixtiyoriy URL)</label>
        <input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://" />
      </div>
      <div className="field">
        <label>Sana va vaqt</label>
        <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} required />
      </div>
      {error ? <p className="small" style={{ color: "var(--danger)" }}>{error}</p> : null}
      {done ? (
        <div className={`lx-form-done${done.needsReview ? " is-next" : ""}`} role="status" data-testid="lesson-created">
          <strong>Dars «{done.courseTitle}» rejasiga qo‘shildi.</strong>
          {done.needsReview ? (
            <>
              <span>Kurs hali qoralama — o‘quvchilar ko‘rishi va efir ochilishi uchun uni tekshiruvga yuboring.</span>
              <Link href="/teacher#kurslar" className="btn btn-primary btn-sm">
                Tekshiruvga yuborish
              </Link>
            </>
          ) : null}
        </div>
      ) : null}
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? "Saqlanmoqda..." : "Jadvalga qo\u2018shish"}
      </button>
    </form>
  );
}
