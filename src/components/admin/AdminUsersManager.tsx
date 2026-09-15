"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { RoleAvatar } from "@/components/admin/RoleAvatar";
import { SoftExpand } from "@/components/admin/SoftDisclosure";

type UserRole = "student" | "teacher" | "admin";
type StatusFilter = "all" | "active" | "blocked" | "subscribed" | "none";

export type AdminUserCourse = {
  title: string;
  lessons: number;
  students: number;
  tier?: string;
  active?: boolean;
  endsAt?: string;
  teacher?: string;
};

export type AdminUserRow = {
  id: string;
  fullName: string;
  role: UserRole;
  isBlocked: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  hasSubscription: boolean;
  tariff: string | null;
  tariffUntil: string | null;
  courseCount: number;
  completedCourses: number;
  lessonCount: number;
  liveCount: number;
  studentCount: number;
  paymentCount: number;
  facultyName: string | null;
  subjectName: string | null;
  courses: AdminUserCourse[];
  email?: string;
  hasPassword?: boolean;
  loginViaGoogle?: boolean;
};

function formatWhen(iso: string | null) {
  if (!iso) return "Hali kirmagan";
  return new Intl.DateTimeFormat("uz-UZ", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
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

export function AdminUsersManager({
  users,
  canSeeSecrets,
}: {
  users: AdminUserRow[];
  canSeeSecrets: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [showPw, setShowPw] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((user) => {
      if (statusFilter === "blocked" && !user.isBlocked) return false;
      if (statusFilter === "active" && user.isBlocked) return false;
      if (statusFilter === "subscribed" && !user.hasSubscription) return false;
      if (statusFilter === "none" && user.hasSubscription) return false;
      if (!q) return true;
      const haystack = [
        user.fullName,
        canSeeSecrets ? user.email : "",
        ...user.courses.map((c) => `${c.title} ${c.teacher ?? ""}`),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [users, query, statusFilter, canSeeSecrets]);

  const markCopied = (key: string) => {
    setCopied(key);
    window.setTimeout(() => setCopied(""), 1600);
  };

  const resetPassword = async (userId: string) => {
    setBusyId(userId);
    setError("");
    setOpenId(userId);
    const res = await fetch(`/api/admin/users/${userId}/reset-password`, { method: "POST" });
    const data = await res.json();
    setBusyId("");
    if (!res.ok) {
      setError(data.error || "Parol tiklanmadi");
      return "";
    }
    setRevealed((prev) => ({ ...prev, [userId]: data.password }));
    setShowPw((prev) => ({ ...prev, [userId]: true }));
    router.refresh();
    return data.password as string;
  };

  const revealPassword = async (userId: string) => {
    if (revealed[userId]) {
      setShowPw((prev) => ({ ...prev, [userId]: !prev[userId] }));
      setOpenId(userId);
      return;
    }
    const password = await resetPassword(userId);
    if (password) {
      await copyText(password);
      markCopied(`pw-${userId}`);
    }
  };

  const copyPassword = async (userId: string) => {
    const password = revealed[userId] || (await resetPassword(userId));
    if (!password) return;
    await copyText(password);
    markCopied(`pw-${userId}`);
  };

  const copyValue = async (key: string, value: string) => {
    if (!value) return;
    await copyText(value);
    markCopied(key);
  };

  const toggleBlock = async (user: AdminUserRow) => {
    setBusyId(user.id);
    setError("");
    const res = await fetch(`/api/admin/users/${user.id}/block`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocked: !user.isBlocked }),
    });
    const data = await res.json();
    setBusyId("");
    if (!res.ok) {
      setError(data.error || "Holat o'zgarmadi");
      return;
    }
    router.refresh();
  };

  const colSpan = canSeeSecrets ? 8 : 6;
  const activeCount = users.filter((u) => !u.isBlocked && u.hasSubscription).length;

  return (
    <>
      <div className="staff-head">
        <div>
          <p className="lx-kicker" style={{ marginBottom: 4 }}>O&apos;quvchilar</p>
          <h2>Talabalar</h2>
          <p className="small muted" style={{ marginTop: 4 }}>
            Jami {users.length} · faol obuna {activeCount}. O&apos;qituvchilar alohida sahifada.
            {canSeeSecrets
              ? " Login ochiq; yangi parol bir marta ko'rinadi."
              : " Login va parol faqat super adminga."}
          </p>
        </div>
      </div>

      {error ? <p className="small" style={{ color: "var(--danger)", marginBottom: 12 }}>{error}</p> : null}

      <div className="staff-toolbar">
        <div className="staff-search">
          <Icon name="search" size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={canSeeSecrets ? "Ism, email yoki kurs..." : "Ism yoki kurs..."}
          />
        </div>
        <select
          className="staff-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
        >
          <option value="all">Barchasi</option>
          <option value="subscribed">Faol obuna</option>
          <option value="none">Obunasiz</option>
          <option value="active">Bloklanmagan</option>
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
              <th>Tarif</th>
              <th>Kurslar</th>
              <th>Oxirgi kirish</th>
              <th>Holat</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => {
              const open = openId === user.id;
              const pw = revealed[user.id];
              const visible = Boolean(showPw[user.id] && pw);
              return (
                <Fragment key={user.id}>
                  <tr
                    className={open ? "staff-row-open" : undefined}
                    onClick={() => setOpenId(open ? null : user.id)}
                  >
                    <td>
                      <div className="staff-name">
                        <RoleAvatar name={user.fullName} role="student" />
                        <span>{user.fullName}</span>
                      </div>
                    </td>
                    {canSeeSecrets ? (
                      <td>
                        <span className="staff-login">{user.email}</span>
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
                            disabled={busyId === user.id}
                            onClick={() => void revealPassword(user.id)}
                          >
                            <Icon name={visible ? "eyeoff" : "eye"} size={15} />
                          </button>
                          <button
                            type="button"
                            className="iconbtn"
                            aria-label="Nusxalash"
                            disabled={busyId === user.id}
                            onClick={() => void copyPassword(user.id)}
                          >
                            <Icon name="copy" size={15} />
                          </button>
                        </div>
                        {copied === `pw-${user.id}` ? <div className="small muted">Nusxalandi</div> : null}
                      </td>
                    ) : null}
                    <td>
                      {user.hasSubscription ? (
                        <span className="badge success">{user.tariff}</span>
                      ) : (
                        <span className="small muted">Yo&apos;q</span>
                      )}
                    </td>
                    <td className="small muted">{user.courseCount}</td>
                    <td className="small muted">{formatWhen(user.lastLoginAt)}</td>
                    <td>
                      <span className={`badge ${user.isBlocked ? "danger" : "success"}`}>
                        {user.isBlocked ? "Bloklangan" : "Aktiv"}
                      </span>
                    </td>
                    <td>
                      <Icon name={open ? "chevronUp" : "chevronDown"} size={16} />
                    </td>
                  </tr>
                  {open ? (
                    <tr className="staff-detail-row">
                      <td colSpan={colSpan}>
                        <SoftExpand open={open}>
                        <div className="account-card" onClick={(e) => e.stopPropagation()}>
                          <div className="account-card-head">
                            <div className="staff-name">
                              <RoleAvatar name={user.fullName} role="student" size="md" />
                              <div>
                                <div style={{ fontWeight: 600 }}>{user.fullName}</div>
                                <div className="staff-detail-badges">
                                  <span className="badge">O&apos;quvchi</span>
                                  <span className={`badge ${user.isBlocked ? "danger" : "success"}`}>
                                    {user.isBlocked ? "Bloklangan" : "Aktiv"}
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
                                  <input readOnly value={user.email ?? ""} />
                                  <button type="button" className="iconbtn" aria-label="Loginni nusxalash" onClick={() => void copyValue(`login-${user.id}`, user.email ?? "")}>
                                    <Icon name="copy" size={15} />
                                  </button>
                                </div>
                              </div>
                              <div className="account-field">
                                <div className="small muted">Parol</div>
                                <div className="account-field-row">
                                  <input readOnly value={visible ? pw : ""} placeholder="Ko'rsatish yangi parol beradi" />
                                  <button type="button" className="iconbtn" aria-label="Parolni ko'rsatish" disabled={busyId === user.id} onClick={() => void revealPassword(user.id)}>
                                    <Icon name={visible ? "eyeoff" : "eye"} size={15} />
                                  </button>
                                  <button type="button" className="iconbtn" aria-label="Parolni nusxalash" disabled={busyId === user.id} onClick={() => void copyPassword(user.id)}>
                                    <Icon name="copy" size={15} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : null}
                          <div className="account-facts">
                            <div>
                              <div className="small muted">Ro&apos;yxatdan o&apos;tgan</div>
                              <div>{formatWhen(user.createdAt)}</div>
                            </div>
                            <div>
                              <div className="small muted">Oxirgi kirish</div>
                              <div>{formatWhen(user.lastLoginAt)}</div>
                            </div>
                            <div>
                              <div className="small muted">Tarif</div>
                              <div>{user.tariff ?? "Yo'q"}{user.tariffUntil ? ` · ${formatWhen(user.tariffUntil)}` : ""}</div>
                            </div>
                            <div>
                              <div className="small muted">Qatnashgan dars</div>
                              <div>{user.lessonCount}</div>
                            </div>
                            <div>
                              <div className="small muted">Sertifikat</div>
                              <div>{user.completedCourses}</div>
                            </div>
                            <div>
                              <div className="small muted">To&apos;lovlar</div>
                              <div>{user.paymentCount}</div>
                            </div>
                          </div>
                          {user.courses.length > 0 ? (
                            <div style={{ marginBottom: 14 }}>
                              <div className="small muted" style={{ marginBottom: 6 }}>Obunalari</div>
                              <div className="lx-stack">
                                {user.courses.map((course, index) => (
                                  <div key={`${course.title}-${index}`} className="lx-row" style={{ padding: 10 }}>
                                    <div>
                                      <p className="lx-kicker" style={{ marginBottom: 2 }}>
                                        {course.teacher ?? "O'qituvchi"} · {course.tier}
                                        {course.active ? "" : " · tugagan"}
                                      </p>
                                      <h3 style={{ fontSize: 14 }}>{course.title}</h3>
                                      {course.endsAt ? (
                                        <p className="small muted" style={{ margin: 0 }}>
                                          gacha {formatWhen(course.endsAt)}
                                        </p>
                                      ) : null}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="small muted" style={{ marginBottom: 14 }}>Obuna yo&apos;q.</p>
                          )}
                          <div className="staff-detail-actions">
                            <button
                              type="button"
                              className={`btn btn-sm${user.isBlocked ? "" : " btn-danger"}`}
                              disabled={busyId === user.id}
                              onClick={() => void toggleBlock(user)}
                            >
                              {user.isBlocked ? "Blokdan chiqarish" : "Bloklash"}
                            </button>
                            {canSeeSecrets ? (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  disabled={busyId === user.id}
                                  onClick={() => void revealPassword(user.id)}
                                >
                                  {visible ? "Yashirish" : "Parolni ko'rsat"}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  disabled={busyId === user.id}
                                  onClick={() => void resetPassword(user.id).then((password) => {
                                    if (!password) return;
                                    void copyText(password);
                                    markCopied(`pw-${user.id}`);
                                  })}
                                >
                                  Yangi parol
                                </button>
                              </>
                            ) : null}
                          </div>
                          {canSeeSecrets ? (
                            <p className="small muted account-note">
                              Eski parol saqlanmaydi. Ko&apos;z yoki nusxa yangi parol yaratadi.
                            </p>
                          ) : null}
                        </div>
                        </SoftExpand>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 ? <div className="empty">O&apos;quvchi topilmadi.</div> : null}
      </div>
    </>
  );
}
