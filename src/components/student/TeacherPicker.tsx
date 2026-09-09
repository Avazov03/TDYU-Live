"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type FacultyOpt = { id: string; nameUz: string };
type TeacherCard = {
  id: string;
  fullName: string;
  facultyId: string;
  facultyName: string;
  subjectName: string;
  studentCount: number;
};

export function TeacherPicker({
  faculties,
  teachers,
}: {
  faculties: FacultyOpt[];
  teachers: TeacherCard[];
}) {
  const router = useRouter();
  const [facultyId, setFacultyId] = useState(faculties[0]?.id ?? "");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const list = useMemo(
    () => (facultyId ? teachers.filter((t) => t.facultyId === facultyId) : teachers),
    [facultyId, teachers],
  );

  const enroll = async (teacherId: string) => {
    setBusyId(teacherId);
    setError("");
    const res = await fetch("/api/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacherId }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusyId("");
    if (!res.ok) {
      setError(data.error || "Yozilish amalga oshmadi");
      return;
    }
    router.push("/app");
    router.refresh();
  };

  return (
    <div>
      <div className="chiprow" style={{ marginBottom: 18 }}>
        {faculties.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`chip${facultyId === f.id ? " active" : ""}`}
            onClick={() => setFacultyId(f.id)}
          >
            {f.nameUz}
          </button>
        ))}
      </div>
      {error ? <p style={{ color: "var(--danger)", marginBottom: 12 }}>{error}</p> : null}
      {list.length === 0 ? (
        <div className="empty">Bu yo&apos;nalishda o&apos;qituvchi yo&apos;q.</div>
      ) : (
        <div className="studio-hub">
          {list.map((t) => (
            <article key={t.id} className="studio-card">
              <h3>{t.fullName}</h3>
              <p className="small muted">
                {t.facultyName} · {t.subjectName}
              </p>
              <p className="small muted">{t.studentCount} o&apos;quvchi</p>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                style={{ marginTop: 12 }}
                disabled={Boolean(busyId)}
                onClick={() => void enroll(t.id)}
              >
                {busyId === t.id ? "Yozilmoqda..." : "Shu o'qituvchiga yozilish"}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
