"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ImpersonateTeacherButton } from "@/components/admin/ImpersonateTeacherButton";
import { Icon } from "@/components/ui/Icon";
import { initials } from "@/lib/utils";

export type TeacherRow = {
  id: string;
  fullName: string;
  contactEmail: string;
  login: string;
  facultyName: string;
  subjectName: string;
  hasAccount: boolean;
  hasPassword: boolean;
  isBlocked: boolean;
  status: "active" | "invite" | "blocked";
  lastLoginAt: string | null;
  inviteUrl: string | null;
  courseCount: number;
};

export type InviteRow = {
  id: string;
  teacherId: string;
  teacherName: string;
  url: string;
  expiresAt: string;
};

type StatusFilter = "all" | TeacherRow["status"];

function formatLoginAt(iso: string | null) {
  if (!iso) return "Hali kirmagan";
  return new Intl.DateTimeFormat("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function statusLabel(status: TeacherRow["status"]) {
  if (status === "blocked") return "Bloklangan";
  if (status === "invite") return "Invite";
  return "Aktiv";
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.left = "-9999px";
    document.body.appendChild(field);
    field.select();
    document.execCommand("copy");
    field.remove();
  }
}

export function AdminTeachersManager({
  teachers,
  invites,
  faculties,
  subjects,
  canSeeSecrets,
}: {
  teachers: TeacherRow[];
  invites: InviteRow[];
  faculties: { id: string; nameUz: string }[];
  subjects: { id: string; facultyId: string; nameUz: string }[];
  canSeeSecrets: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [facultyId, setFacultyId] = useState(faculties[0]?.id ?? "");
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [showPw, setShowPw] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState("");

  const filteredSubjects = subjects.filter((s) => s.facultyId === facultyId);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return teachers.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        t.fullName.toLowerCase().includes(q) ||
        t.login.toLowerCase().includes(q) ||
        t.contactEmail.toLowerCase().includes(q)
      );
    });
  }, [teachers, query, statusFilter]);

  const markCopied = (key: string) => {
    setCopied(key);
    window.setTimeout(() => setCopied(""), 1600);
  };

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
    if (data.inviteUrl) {
      await copyText(data.inviteUrl);
      markCopied("new-invite");
    }
    setFullName("");
    setContactEmail("");
    setModalOpen(false);
    router.refresh();
  };

  const revokeInvite = async (id: string) => {
    setBusyId(id);
    await fetch(`/api/admin/teachers/invites/${id}`, { method: "DELETE" });
    setBusyId("");
    router.refresh();
  };

  const resetPassword = async (teacherId: string) => {
    setBusyId(teacherId);
    setError("");
    setOpenId(teacherId);
    const res = await fetch(`/api/admin/teachers/${teacherId}/reset-password`, { method: "POST" });
    const data = await res.json();
    setBusyId("");
    if (!res.ok) {
      setError(data.error || "Parol tiklanmadi");
      return "";
    }
    setRevealed((prev) => ({ ...prev, [teacherId]: data.password }));
    setShowPw((prev) => ({ ...prev, [teacherId]: true }));
    router.refresh();
    return data.password as string;
  };

  const revealPassword = async (teacherId: string) => {
    if (revealed[teacherId]) {
      setShowPw((prev) => ({ ...prev, [teacherId]: !prev[teacherId] }));
      setOpenId(teacherId);
      return;
    }
    const password = await resetPassword(teacherId);
    if (password) {
      await copyText(password);
      markCopied(`pw-${teacherId}`);
    }
  };

  const copyPassword = async (teacherId: string) => {
    const password = revealed[teacherId] || (await resetPassword(teacherId));
    if (!password) return;
    await copyText(password);
    markCopied(`pw-${teacherId}`);
  };

  const copyValue = async (key: string, value: string) => {
    if (!value) return;
    await copyText(value);
    markCopied(key);
  };

  const toggleBlock = async (t: TeacherRow) => {
    setBusyId(t.id);
    const res = await fetch(`/api/admin/teachers/${t.id}/block`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocked: !t.isBlocked }),
    });
    setBusyId("");
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Holat o'zgarmadi");
      return;
    }
    router.refresh();
  };

  const exportCsv = () => {
    const lines = [
      ["F.I.SH.", ...(canSeeSecrets ? ["Login"] : []), "Fan", "Fakultet", "Holat", "Oxirgi kirish", "Kurs"].join(","),
      ...filtered.map((t) =>
        [
          `"${t.fullName.replaceAll('"', '""')}"`,
          ...(canSeeSecrets ? [t.login] : []),
          `"${t.subjectName.replaceAll('"', '""')}"`,
          `"${t.facultyName.replaceAll('"', '""')}"`,
          statusLabel(t.status),
          formatLoginAt(t.lastLoginAt),
          t.courseCount,
        ].join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "oqituvchilar.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <div className="staff-head">
        <div>
          <p className="lx-kicker" style={{ marginBottom: 4 }}>O&apos;qituvchilar</p>
          <h2>O&apos;qituvchi jamoasi</h2>
          <p className="small muted" style={{ marginTop: 4 }}>
            Jami {teachers.length}. O&apos;quvchilar alohida sahifada.
          {canSeeSecrets
            ? " Parolni tiklasangiz yangi parol bir marta ko'rinadi va nusxalanadi."
            : " Login, email va parol faqat super adminga ko'rinadi."}
          </p>
        </div>
        <div className="staff-head-actions">
          <button type="button" className="btn btn-sm" onClick={exportCsv}>
            Export
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setModalOpen(true)}>
            Taklif havolasi
          </button>
        </div>
      </div>

      {error ? <p className="small" style={{ color: "var(--danger)", marginBottom: 12 }}>{error}</p> : null}
      {copied === "new-invite" ? (
        <p className="small muted" style={{ marginBottom: 12 }}>Yangi taklif havolasi nusxalandi.</p>
      ) : null}

      <div className="card staff-invites">
        <div className="staff-invites-head">
          <h3>Faol taklif havolalari</h3>
          <button type="button" className="btn btn-sm" onClick={() => router.refresh()}>
            Yangilash
          </button>
        </div>
        {invites.length === 0 ? (
          <p className="small muted">Hozircha faol havola yo&apos;q. Yuqoridan taklif yarating.</p>
        ) : (
          invites.map((inv) => (
            <div key={inv.id} className="staff-invite-row">
              <div className="staff-invite-meta">
                <span className="small muted">Rol: O&apos;qituvchi · {inv.teacherName}</span>
                <code className="staff-invite-url">{inv.url}</code>
              </div>
              <div className="staff-icon-actions">
                <button
                  type="button"
                  className="iconbtn"
                  aria-label="Nusxalash"
                  onClick={() => {
                    void copyText(inv.url).then(() => markCopied(inv.id));
                  }}
                >
                  <Icon name="copy" size={16} />
                </button>
                <button
                  type="button"
                  className="iconbtn"
                  aria-label="Bekor qilish"
                  disabled={busyId === inv.id}
                  onClick={() => void revokeInvite(inv.id)}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="staff-toolbar">
        <div className="staff-search">
          <Icon name="search" size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ism yoki login..."
          />
        </div>
        <select
          className="staff-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
        >
          <option value="all">Barcha holatlar</option>
          <option value="active">Aktiv</option>
          <option value="invite">Invite</option>
          <option value="blocked">Bloklangan</option>
        </select>
      </div>

      <div className="admin-table-wrap card" style={{ padding: 0 }}>
        <table className="staff-table">
          <thead>
            <tr>
              <th>F.I.SH.</th>
              {canSeeSecrets ? <th>Login</th> : null}
              {canSeeSecrets ? <th>Parol</th> : null}
              <th>Rol</th>
              <th>Fan</th>
              <th>Holat</th>
              <th>Oxirgi kirish</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const open = openId === t.id;
              const pw = revealed[t.id];
              const visible = Boolean(showPw[t.id] && pw);
              return (
                <Fragment key={t.id}>
                  <tr
                    className={open ? "staff-row-open" : undefined}
                    onClick={() => setOpenId(open ? null : t.id)}
                  >
                    <td>
                      <div className="staff-name">
                        <span className="avatar sm">{initials(t.fullName)}</span>
                        <span>{t.fullName}</span>
                      </div>
                    </td>
                    {canSeeSecrets ? (
                      <td>
                        <span className="staff-login">{t.login}</span>
                      </td>
                    ) : null}
                    {canSeeSecrets ? (
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="staff-pw">
                          <span>{visible ? pw : "Ko'rsatish"}</span>
                          <button
                            type="button"
                            className="iconbtn"
                            aria-label="Ko'rsat"
                            disabled={busyId === t.id}
                            onClick={() => void revealPassword(t.id)}
                          >
                            <Icon name={visible ? "eyeoff" : "eye"} size={15} />
                          </button>
                          <button
                            type="button"
                            className="iconbtn"
                            aria-label="Nusxalash"
                            disabled={busyId === t.id}
                            onClick={() => void copyPassword(t.id)}
                          >
                            <Icon name="copy" size={15} />
                          </button>
                        </div>
                        {copied === `pw-${t.id}` ? <div className="small muted">Nusxalandi</div> : null}
                      </td>
                    ) : null}
                    <td>
                      <span className="badge accent">O&apos;qituvchi</span>
                    </td>
                    <td className="small muted">{t.subjectName}</td>
                    <td>
                      <span className={`badge ${t.status === "active" ? "success" : t.status === "blocked" ? "danger" : "pending"}`}>
                        {statusLabel(t.status)}
                      </span>
                    </td>
                    <td className="small muted">{formatLoginAt(t.lastLoginAt)}</td>
                    <td>
                      <Icon name={open ? "chevronUp" : "chevronDown"} size={16} />
                    </td>
                  </tr>
                  {open ? (
                    <tr className="staff-detail-row">
                      <td colSpan={canSeeSecrets ? 8 : 6}>
                        <div className="account-card" onClick={(e) => e.stopPropagation()}>
                          <div className="account-card-head">
                            <div className="staff-name">
                              <span className="avatar">{initials(t.fullName)}</span>
                              <div>
                                <div style={{ fontWeight: 600 }}>{t.fullName}</div>
                                <div className="staff-detail-badges">
                                  <span className="badge accent">O&apos;qituvchi</span>
                                  <span className={`badge ${t.status === "active" ? "success" : t.status === "blocked" ? "danger" : "pending"}`}>
                                    {statusLabel(t.status)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          {canSeeSecrets ? (
                            <div className="account-creds">
                              <div className="account-field">
                                <div className="small muted">Login</div>
                                <div className="account-field-row">
                                  <input readOnly value={t.login} />
                                  <button type="button" className="iconbtn" aria-label="Loginni nusxalash" onClick={() => void copyValue(`login-${t.id}`, t.login)}>
                                    <Icon name="copy" size={15} />
                                  </button>
                                </div>
                                {copied === `login-${t.id}` ? <div className="small muted">Nusxalandi</div> : null}
                              </div>
                              <div className="account-field">
                                <div className="small muted">Email</div>
                                <div className="account-field-row">
                                  <input readOnly value={t.contactEmail} />
                                  <button type="button" className="iconbtn" aria-label="Emailni nusxalash" onClick={() => void copyValue(`mail-${t.id}`, t.contactEmail)}>
                                    <Icon name="copy" size={15} />
                                  </button>
                                </div>
                                {copied === `mail-${t.id}` ? <div className="small muted">Nusxalandi</div> : null}
                              </div>
                              <div className="account-field">
                                <div className="small muted">Parol</div>
                                <div className="account-field-row">
                                  <input readOnly value={visible ? pw : ""} placeholder="Ko'rsatish yangi parol beradi" />
                                  <button type="button" className="iconbtn" aria-label="Parolni ko'rsatish" disabled={busyId === t.id} onClick={() => void revealPassword(t.id)}>
                                    <Icon name={visible ? "eyeoff" : "eye"} size={15} />
                                  </button>
                                  <button type="button" className="iconbtn" aria-label="Parolni nusxalash" disabled={busyId === t.id} onClick={() => void copyPassword(t.id)}>
                                    <Icon name="copy" size={15} />
                                  </button>
                                </div>
                                {copied === `pw-${t.id}` ? <div className="small muted">Nusxalandi</div> : null}
                              </div>
                            </div>
                          ) : null}
                          <div className="account-facts">
                            <div>
                              <div className="small muted">Fan</div>
                              <div>{t.subjectName}</div>
                            </div>
                            <div>
                              <div className="small muted">Fakultet</div>
                              <div>{t.facultyName}</div>
                            </div>
                            <div>
                              <div className="small muted">Kurslar</div>
                              <div>{t.courseCount}</div>
                            </div>
                            <div>
                              <div className="small muted">Oxirgi kirish</div>
                              <div>{formatLoginAt(t.lastLoginAt)}</div>
                            </div>
                          </div>
                          {canSeeSecrets ? (
                            <p className="small muted account-note">Eski parol saqlanmaydi. Ko&apos;z yoki nusxa yangi parol yaratadi va nusxalaydi.</p>
                          ) : null}
                          {t.inviteUrl ? (
                            <div className="account-field">
                              <div className="small muted">Taklif havolasi</div>
                              <div className="account-field-row">
                                <input readOnly value={t.inviteUrl} />
                                <button type="button" className="iconbtn" aria-label="Havolani nusxalash" onClick={() => void copyValue(`inv-${t.id}`, t.inviteUrl || "")}>
                                  <Icon name="copy" size={15} />
                                </button>
                              </div>
                            </div>
                          ) : null}
                          <div className="staff-detail-actions">
                            <ImpersonateTeacherButton teacherId={t.id} className="btn btn-sm" />
                            {canSeeSecrets ? (
                              <button type="button" className="btn btn-sm" disabled={busyId === t.id} onClick={() => void resetPassword(t.id)}>
                                Yangi parol
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              disabled={busyId === t.id || !t.hasAccount}
                              onClick={() => void toggleBlock(t)}
                            >
                              {t.isBlocked ? "Blokdan chiqarish" : "Bloklash"}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 ? <div className="empty">O&apos;qituvchi topilmadi.</div> : null}
      </div>

      {modalOpen ? (
      <div className="modal-overlay open" onClick={() => setModalOpen(false)}>
        <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
          <h3 style={{ marginBottom: 12 }}>Taklif havolasi</h3>
          <form onSubmit={create}>
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
            <div className="row gap-8" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-sm" onClick={() => setModalOpen(false)}>Bekor</button>
              <button className="btn btn-sm btn-primary" type="submit">Yaratish va nusxalash</button>
            </div>
            {error ? (
              <p className="small" style={{ color: "var(--danger)", marginTop: 10 }}>{error}</p>
            ) : null}
          </form>
        </div>
      </div>
      ) : null}
    </>
  );
}
