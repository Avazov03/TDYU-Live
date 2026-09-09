"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatSom } from "@/lib/tariffs";

type CourseRow = {
  id: string;
  titleUz: string;
  teacherName: string;
  facultyName: string;
  subjectName: string;
  priceT1: number;
  priceT2: number;
  priceT3: number;
  lessonCount: number;
  studentCount: number;
};

export function AdminCoursesManager({
  courses,
  teachers,
  faculties,
  subjects,
}: {
  courses: CourseRow[];
  teachers: { id: string; fullName: string }[];
  faculties: { id: string; nameUz: string }[];
  subjects: { id: string; facultyId: string; nameUz: string }[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    titleUz: "",
    descriptionUz: "",
    teacherId: teachers[0]?.id ?? "",
    facultyId: faculties[0]?.id ?? "",
    subjectId: subjects[0]?.id ?? "",
    priceT1: "150000",
    priceT2: "250000",
    priceT3: "400000",
  });

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/admin/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        priceT1: Number(form.priceT1),
        priceT2: Number(form.priceT2),
        priceT3: Number(form.priceT3),
      }),
    });
    router.refresh();
  };

  return (
    <>
      <h2 style={{ marginBottom: 16 }}>Kurslar va tariflar</h2>
      <form onSubmit={create} className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 12 }}>Yangi kurs</h3>
        <div className="field">
          <label>Nomi</label>
          <input value={form.titleUz} onChange={(e) => set("titleUz", e.target.value)} required />
        </div>
        <div className="field">
          <label>Tavsif</label>
          <textarea value={form.descriptionUz} onChange={(e) => set("descriptionUz", e.target.value)} required />
        </div>
        <div className="field">
          <label>O&apos;qituvchi</label>
          <select value={form.teacherId} onChange={(e) => set("teacherId", e.target.value)}>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.fullName}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Fakultet</label>
          <select value={form.facultyId} onChange={(e) => set("facultyId", e.target.value)}>
            {faculties.map((f) => (
              <option key={f.id} value={f.id}>{f.nameUz}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Fan</label>
          <select value={form.subjectId} onChange={(e) => set("subjectId", e.target.value)}>
            {subjects.filter((s) => s.facultyId === form.facultyId).map((s) => (
              <option key={s.id} value={s.id}>{s.nameUz}</option>
            ))}
          </select>
        </div>
        <div className="row gap-12">
          <div className="field" style={{ flex: 1 }}>
            <label>1-tarif</label>
            <input value={form.priceT1} onChange={(e) => set("priceT1", e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>2-tarif</label>
            <input value={form.priceT2} onChange={(e) => set("priceT2", e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>3-tarif</label>
            <input value={form.priceT3} onChange={(e) => set("priceT3", e.target.value)} />
          </div>
        </div>
        <button className="btn btn-primary" type="submit">Saqlash</button>
      </form>

      <div className="admin-table-wrap card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Kurs</th>
              <th>O&apos;qituvchi</th>
              <th>Narx</th>
              <th>O&apos;quvchi</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.id}>
                <td>
                  {c.titleUz}
                  <div className="small muted">{c.subjectName} · {c.lessonCount} dars</div>
                </td>
                <td>{c.teacherName}</td>
                <td className="small">
                  {formatSom(c.priceT1)} / {formatSom(c.priceT2)} / {formatSom(c.priceT3)}
                </td>
                <td>{c.studentCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
