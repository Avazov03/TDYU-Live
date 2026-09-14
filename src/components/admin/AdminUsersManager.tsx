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
  await navigator.clipboard.writeText(value);
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

  const resetPassword = async (userId: string) => {
    setBusyId(userId);
    setError("");
    const res = await fetch(`/api/admin/users/${userId}/reset-password`, { method: "POST" });
    const data = await res.json();
    setBusyId("");
    if (!res.ok) {
      setError(data.error || "Parol tiklanmadi");
      return;
    }
    setRevealed((prev) => ({ ...prev, [userId]: data.password }));
    setShowPw((prev) => ({ ...prev, [userId]: true }));
    await copyText(data.password);
    setCopied(userId);
    window.setTimeout(() => setCopied(""), 1600);
    router.refresh();
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
                          <span>{visible ? pw : user.hasPassword ? "********" : "yo'q"}</span>
                          {pw ? (
                            <button
                              type="button"
                              className="iconbtn"
                              aria-label="Ko'rsat"
                              onClick={() => setShowPw((prev) => ({ ...prev, [user.id]: !prev[user.id] }))}
                            >
                              <Icon name={visible ? "eyeoff" : "eye"} size={15} />
                            </button>
                          ) : null}
                        </div>
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
                        <div className="staff-detail">
                          <div className="staff-detail-grid">
                            {canSeeSecrets ? (
                              <div>
                                <div className="small muted">Email</div>
                                <div>{user.email}</div>
                              </div>
                            ) : null}
                            <div>
                              <div className="small muted">Oxirgi kirish</div>
                              <div>{formatWhen(user.lastLoginAt)}</div>
                            </div>
                            <div>
                              <div className="small muted">Tarif</div>
                              <div>
                                {user.tariff ?? "Yo'q"}
                                {user.tariffUntil ? ` · ${formatWhen(user.tariffUntil)}` : ""}
                              </div>
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
                            {canSeeSecrets ? (
                              <div>
                                <div className="small muted">Kirish</div>
                                <div>
                                  {user.hasPassword ? "Parol bor" : "Parol yo'q"}
                                  {user.loginViaGoogle ? " · Google" : ""}
                                </div>
                              </div>
                            ) : null}
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
                          {canSeeSecrets && pw ? (
                            <p className="small muted">
                              Yangi parol: <code>{pw}</code> {copied === user.id ? "(nusxalandi)" : ""}
                            </p>
                          ) : null}
                          {canSeeSecrets ? (
                            <div className="staff-detail-actions" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                className="btn btn-sm"
                                disabled={busyId === user.id}
                                onClick={() => void resetPassword(user.id)}
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
