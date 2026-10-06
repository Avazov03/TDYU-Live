"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { localInputToIso, nextTashkentHourInput } from "@/lib/utils";

const defaultSlot = () => nextTashkentHourInput();

export function CreateLessonForm({
  courses,
}: {
  courses: { id: string; titleUz: string; statusText: string; needsReview?: boolean }[];
}) {
  const fid = useId();
  const router = useRouter();
  const [done, setDone] = useState<{ courseTitle: string; needsReview: boolean } | null>(null);
  const [courseId, setCourseId] = useState(courses.length === 1 ? courses[0].id : "");
  const selected = courses.find((c) => c.id === courseId);
  const [titleUz, setTitleUz] = useState("");
  const [summaryUz, setSummaryUz] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [scheduledAt, setScheduledAt] = useState(defaultSlot);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!courseId) {
      setError("Qaysi kursga dars qo‘shilishini tanlang");
      return;
    }
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
        <label htmlFor="cl-course">Kurs</label>
        <select
          id="cl-course"
          value={courseId}
          onChange={(e) => {
            setCourseId(e.target.value);
            setError("");
          }}
          aria-invalid={error && !courseId ? true : undefined}
        >
          {courses.length > 1 ? (
            <option value="" disabled>
              Kursni tanlang…
            </option>
          ) : null}
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.titleUz} — {c.statusText}
            </option>
          ))}
        </select>
        {selected?.needsReview ? (
          <span className="small muted" style={{ display: "block", marginTop: 6 }}>
            Bu kurs hali qoralama: darslarni rejalashtirasiz, o‘quvchilar esa ularni kurs tekshiruvdan o‘tib nashr
            etilgach ko‘radi.
          </span>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor={`${fid}-1`}>Mavzu</label>
        <input id={`${fid}-1`} value={titleUz} onChange={(e) => setTitleUz(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor={`${fid}-2`}>Qisqa ma&apos;lumot</label>
        <textarea id={`${fid}-2`} value={summaryUz} onChange={(e) => setSummaryUz(e.target.value)} maxLength={500} rows={3} />
      </div>
      <div className="field">
        <label htmlFor={`${fid}-3`}>Banner rasmi (ixtiyoriy URL)</label>
        <input id={`${fid}-3`} value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://" />
      </div>
      <div className="field">
        <label htmlFor={`${fid}-4`}>Sana va vaqt</label>
        <input id={`${fid}-4`} type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} required />
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
