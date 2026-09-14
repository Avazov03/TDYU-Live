"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { initials } from "@/lib/utils";

type UserRole = "student" | "teacher" | "admin";
type RoleFilter = "all" | UserRole;

export type AdminUserCourse = {
  title: string;
  lessons: number;
  students: number;
  tier?: string;
  active?: boolean;
  endsAt?: string;
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
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function roleLabel(role: UserRole) {
  if (role === "admin") return "Admin";
  if (role === "teacher") return "O'qituvchi";
  return "O'quvchi";
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
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [showPw, setShowPw] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter !== "all" && user.role !== roleFilter) return false;
      if (!q) return true;
      const haystack = [user.fullName, canSeeSecrets ? user.email : ""].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [users, query, roleFilter, canSeeSecrets]);

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

  const colSpan = canSeeSecrets ? 8 : 6;

  return (
    <>
      <div className="staff-head">
        <div>
          <h2>Foydalanuvchilar</h2>
          <p className="small muted" style={{ marginTop: 4 }}>
            Jami {users.length}.{" "}
            {canSeeSecrets
              ? "Login va email ochiq. Asl parol saqlanmaydi — yangi parol bir marta ko'rinadi."
              : "Login, email va parol faqat super adminga ko'rinadi."}
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
            placeholder={canSeeSecrets ? "Ism yoki email..." : "Ism..."}
          />
        </div>
        <select
          className="staff-filter"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
        >
          <option value="all">Barcha rollar</option>
          <option value="student">O'quvchi</option>
          <option value="teacher">O'qituvchi</option>
          <option value="admin">Admin</option>
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
              <th>Obuna</th>
              <th>Ro&apos;yxat</th>
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
                        <span className="avatar sm">{initials(user.fullName)}</span>
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
                      <span className={`badge ${user.role === "admin" ? "accent" : user.role === "teacher" ? "pending" : ""}`}>
                        {roleLabel(user.role)}
                      </span>
                      {user.isSuperAdmin ? <span className="badge accent" style={{ marginLeft: 6 }}>Super</span> : null}
                    </td>
                    <td>
                      {user.hasSubscription ? (
                        <span className="badge success">{user.tariff}</span>
                      ) : (
                        <span className="small muted">Yo&apos;q</span>
                      )}
                    </td>
                    <td className="small muted">{formatWhen(user.createdAt)}</td>
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
                        <div className="account-card" onClick={(e) => e.stopPropagation()}>
                          <div className="account-card-head">
                            <div className="staff-name">
                              <span className="avatar">{initials(user.fullName)}</span>
                              <div>
                                <div style={{ fontWeight: 600 }}>{user.fullName}</div>
                                <div className="staff-detail-badges">
                                  <span className={`badge ${user.role === "admin" ? "accent" : user.role === "teacher" ? "pending" : ""}`}>
                                    {roleLabel(user.role)}
                                  </span>
                                  {user.isSuperAdmin ? <span className="badge accent">Super</span> : null}
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
                                {copied === `login-${user.id}` ? <div className="small muted">Nusxalandi</div> : null}
                              </div>
                              <div className="account-field">
                                <div className="small muted">Email</div>
                                <div className="account-field-row">
                                  <input readOnly value={user.email ?? ""} />
                                  <button type="button" className="iconbtn" aria-label="Emailni nusxalash" onClick={() => void copyValue(`mail-${user.id}`, user.email ?? "")}>
                                    <Icon name="copy" size={15} />
                                  </button>
                                </div>
                                {copied === `mail-${user.id}` ? <div className="small muted">Nusxalandi</div> : null}
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
                                {copied === `pw-${user.id}` ? <div className="small muted">Nusxalandi</div> : null}
                              </div>
                            </div>
                          ) : null}
                          <div className="account-facts">
                            <div>
                              <div className="small muted">Oxirgi kirish</div>
                              <div>{formatWhen(user.lastLoginAt)}</div>
                            </div>
                            <div>
                              <div className="small muted">Tarif</div>
                              <div>{user.tariff ?? "Yo'q"}{user.tariffUntil ? ` · ${formatWhen(user.tariffUntil)}` : ""}</div>
                            </div>
                            <div>
                              <div className="small muted">Kurslar</div>
                              <div>{user.courseCount}</div>
                            </div>
                            <div>
                              <div className="small muted">Tugatgan</div>
                              <div>{user.completedCourses}</div>
                            </div>
                            <div>
                              <div className="small muted">{user.role === "teacher" ? "Darslar" : "Qatnashgan darslar"}</div>
                              <div>{user.lessonCount}</div>
                            </div>
                            {user.role === "teacher" ? (
                              <>
                                <div>
                                  <div className="small muted">Efirlar</div>
                                  <div>{user.liveCount}</div>
                                </div>
                                <div>
                                  <div className="small muted">O&apos;quvchilar</div>
                                  <div>{user.studentCount}</div>
                                </div>
                                <div>
                                  <div className="small muted">Fan</div>
                                  <div>{user.subjectName ?? "—"}</div>
                                </div>
                                <div>
                                  <div className="small muted">Fakultet</div>
                                  <div>{user.facultyName ?? "—"}</div>
                                </div>
                              </>
                            ) : null}
                            <div>
                              <div className="small muted">To&apos;lovlar</div>
                              <div>{user.paymentCount}</div>
                            </div>
                          </div>
                          {user.courses.length > 0 ? (
                            <div style={{ marginBottom: 14 }}>
                              <div className="small muted" style={{ marginBottom: 6 }}>
                                {user.role === "teacher" ? "Kurslari" : "Obunalari"}
                              </div>
                              {user.courses.map((course, index) => (
                                <div key={`${course.title}-${index}`} className="small">
                                  {course.title}
                                  {user.role === "teacher"
                                    ? ` · ${course.lessons} dars · ${course.students} o'quvchi`
                                    : course.tier
                                      ? ` · ${course.tier}${course.active ? "" : " · tugagan"}`
                                      : ""}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="small muted" style={{ marginBottom: 14 }}>
                              {user.role === "teacher" ? "Kurs yo'q." : "Obuna yo'q."}
                            </p>
                          )}
                          {canSeeSecrets ? (
                            <p className="small muted account-note">Eski parol saqlanmaydi. Ko&apos;z yoki nusxa yangi parol yaratadi va nusxalaydi.</p>
                          ) : null}
                          {canSeeSecrets ? (
                            <div className="staff-detail-actions">
                              <button
                                type="button"
                                className="btn btn-sm"
                                disabled={busyId === user.id}
                                onClick={() => void revealPassword(user.id)}
                              >
                                {visible ? "Yashirish" : "Ko'rsatish"}
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
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 ? <div className="empty">Foydalanuvchi topilmadi.</div> : null}
      </div>
    </>
  );
}
