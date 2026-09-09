"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImpersonateTeacherButton } from "@/components/admin/ImpersonateTeacherButton";

type TeacherRow = {
  id: string;
  fullName: string;
  contactEmail: string;
  facultyName: string;
  subjectName: string;
  hasAccount: boolean;
  inviteUrl: string | null;
  courseCount: number;
};

export function AdminTeachersManager({
  teachers,
  faculties,
  subjects,
}: {
  teachers: TeacherRow[];
  faculties: { id: string; nameUz: string }[];
  subjects: { id: string; facultyId: string; nameUz: string }[];
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [facultyId, setFacultyId] = useState(faculties[0]?.id ?? "");
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [inviteLink, setInviteLink] = useState("");
  const [error, setError] = useState("");

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/teachers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, contactEmail, facultyId, subjectId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Saqlanmadi");
      return;
    }
    setInviteLink(data.inviteUrl);
    setFullName("");
    setContactEmail("");
    router.refresh();
  };

  const filteredSubjects = subjects.filter((s) => s.facultyId === facultyId);

  return (
    <>
      <h2 style={{ marginBottom: 16 }}>O&apos;qituvchilar</h2>
      <form onSubmit={create} className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 12 }}>Yangi o&apos;qituvchi + invite</h3>
        <div className="field">
          <label>Ism</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div className="field">
          <label>Email</label>
          <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label>Fakultet</label>
          <select
            value={facultyId}
            onChange={(e) => {
              setFacultyId(e.target.value);
              const first = subjects.find((s) => s.facultyId === e.target.value);
              if (first) setSubjectId(first.id);
            }}
          >
            {faculties.map((f) => (
              <option key={f.id} value={f.id}>{f.nameUz}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Fan</label>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            {filteredSubjects.map((s) => (
              <option key={s.id} value={s.id}>{s.nameUz}</option>
            ))}
          </select>
        </div>
        {error ? <p className="small" style={{ color: "var(--danger)" }}>{error}</p> : null}
        <button className="btn btn-primary" type="submit">Yaratish va link olish</button>
        {inviteLink ? (
          <p className="small" style={{ marginTop: 10 }}>
            Invite: <code>{inviteLink}</code>
          </p>
        ) : null}
      </form>

      <div className="admin-table-wrap card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Ism</th>
              <th>Fan</th>
              <th>Hisob</th>
              <th>Kurs</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((t) => (
              <tr key={t.id}>
                <td>
                  {t.fullName}
                  <div className="small muted">{t.contactEmail}</div>
                </td>
                <td>
                  {t.subjectName}
                  <div className="small muted">{t.facultyName}</div>
                </td>
                <td>{t.hasAccount ? <span className="badge success">Faol</span> : <span className="badge pending">Invite</span>}</td>
                <td>{t.courseCount}</td>
                <td>
                  <ImpersonateTeacherButton teacherId={t.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
