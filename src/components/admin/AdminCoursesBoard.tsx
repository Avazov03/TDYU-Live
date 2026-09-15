"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RoleAvatar } from "@/components/admin/RoleAvatar";
import { SoftDisclosure, SoftExpand } from "@/components/admin/SoftDisclosure";
import { AdminDonut, AdminHBar } from "@/components/admin/AdminCharts";
import type { AdminCourseInsight, AdminTeacherCourseGroup, CourseHealth } from "@/lib/admin-courses";
import { formatSom } from "@/lib/tariffs";
import { Icon } from "@/components/ui/Icon";

function healthLabel(h: CourseHealth) {
  if (h === "live") return "Jonli";
  if (h === "on_track") return "Rejada";
  if (h === "empty") return "Rejasiz";
  if (h === "stale") return "To'xtagan";
  return "Tinch";
}

function healthTone(h: CourseHealth) {
  if (h === "live") return "danger";
  if (h === "on_track") return "success";
  if (h === "empty") return "pending";
  if (h === "stale") return "danger";
  return "pending";
}

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("uz-UZ", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

type HealthFilter = "all" | CourseHealth;

export function AdminCoursesBoard({
  groups,
  courses,
  teachers,
  faculties,
  subjects,
  summary,
}: {
  groups: AdminTeacherCourseGroup[];
  courses: AdminCourseInsight[];
  teachers: { id: string; fullName: string }[];
  faculties: { id: string; nameUz: string }[];
  subjects: { id: string; facultyId: string; nameUz: string }[];
  summary: {
    courses: number;
    teachers: number;
    activeStudents: number;
    live: number;
    onTrack: number;
    empty: number;
    stale: number;
  };
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [health, setHealth] = useState<HealthFilter>("all");
  const [teacherId, setTeacherId] = useState("all");
  const [openCourse, setOpenCourse] = useState<string | null>(null);
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
  const [error, setError] = useState("");

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const visibleGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .filter((g) => teacherId === "all" || g.teacherId === teacherId)
      .map((group) => ({
        ...group,
        courses: group.courses.filter((course) => {
          if (health !== "all" && course.health !== health) return false;
          if (!q) return true;
          return `${course.titleUz} ${course.teacherName} ${course.subjectName} ${course.facultyName}`
            .toLowerCase()
            .includes(q);
        }),
      }))
      .filter((g) => g.courses.length > 0);
  }, [groups, query, health, teacherId]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        priceT1: Number(form.priceT1),
        priceT2: Number(form.priceT2),
        priceT3: Number(form.priceT3),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Saqlanmadi");
      return;
    }
    setForm((f) => ({ ...f, titleUz: "", descriptionUz: "" }));
    router.refresh();
  };

  return (
    <div className="admin-board">
      <div className="staff-head">
        <div>
          <p className="lx-kicker" style={{ marginBottom: 4 }}>Kurslar</p>
          <h2>O&apos;qituvchi → kurs → faollik</h2>
          <p className="small muted" style={{ marginTop: 4 }}>
            Bir qarashda kim nima o&apos;qitadi, reja bormi, davomat va obuna qanday.
          </p>
        </div>
      </div>

      <div className="admin-summary">
        <div className="stat-card">
          <div className="small muted">Kurs</div>
          <div className="num">{summary.courses}</div>
        </div>
        <div className="stat-card">
          <div className="small muted">O&apos;qituvchi</div>
          <div className="num">{summary.teachers}</div>
        </div>
        <div className="stat-card">
          <div className="small muted">Faol o&apos;quvchi</div>
          <div className="num">{summary.activeStudents}</div>
        </div>
        <div className="stat-card">
          <div className="small muted">Rejada / jonli</div>
          <div className="num" style={{ fontSize: 20 }}>{summary.onTrack} / {summary.live}</div>
        </div>
        <div className="stat-card">
          <div className="small muted">Rejasiz / tinch</div>
          <div className="num" style={{ fontSize: 20 }}>{summary.empty} / {summary.stale}</div>
        </div>
      </div>

      <div className="admin-charts-grid">
        <section className="admin-panel">
          <div className="admin-panel-head">
            <h3>Kurs holati</h3>
          </div>
          <AdminDonut
            segments={[
              { label: "Rejada", value: summary.onTrack, tone: "t2" },
              { label: "Jonli", value: summary.live, tone: "t3" },
              { label: "Rejasiz", value: summary.empty, tone: "muted" },
              { label: "Tinch/to'xtagan", value: summary.stale, tone: "t1" },
            ]}
          />
        </section>
        <section className="admin-panel">
          <div className="admin-panel-head">
            <h3>Eng faol kurslar</h3>
          </div>
          <AdminHBar
            rows={[...courses]
              .sort((a, b) => b.activeStudents - a.activeStudents)
              .slice(0, 5)
              .map((c) => ({ label: c.titleUz, sub: c.teacherName, value: c.activeStudents }))}
            valueLabel="o'quvchi"
          />
        </section>
      </div>

      <SoftDisclosure title="Yangi kurs" defaultOpen={courses.length === 0}>
        <form onSubmit={create} className="soft-form">
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
          {error ? <p className="small" style={{ color: "var(--danger)" }}>{error}</p> : null}
          <button className="btn btn-primary" type="submit">Saqlash</button>
        </form>
      </SoftDisclosure>

      <div className="staff-toolbar">
        <div className="staff-search">
          <Icon name="search" size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kurs, o'qituvchi, fan..."
          />
        </div>
        <select className="staff-filter" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
          <option value="all">Barcha o&apos;qituvchilar</option>
          {groups.map((g) => (
            <option key={g.teacherId} value={g.teacherId}>{g.teacherName}</option>
          ))}
        </select>
        <select className="staff-filter" value={health} onChange={(e) => setHealth(e.target.value as HealthFilter)}>
          <option value="all">Barcha holat</option>
          <option value="live">Jonli</option>
          <option value="on_track">Rejada</option>
          <option value="empty">Rejasiz</option>
          <option value="idle">Tinch</option>
          <option value="stale">To&apos;xtagan</option>
        </select>
      </div>

      <div className="admin-course-groups">
        {visibleGroups.map((group) => (
          <section key={group.teacherId} className="admin-teacher-block">
            <header className="admin-teacher-head">
              <RoleAvatar name={group.teacherName} role="teacher" size="md" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3>{group.teacherName}</h3>
                <p className="small muted" style={{ margin: 0 }}>
                  {group.facultyName} · {group.subjectName} · {group.courses.length} kurs · {group.activeStudents} faol o&apos;quvchi
                </p>
              </div>
              <div className="admin-teacher-pills">
                {group.live > 0 ? <span className="badge danger">Jonli {group.live}</span> : null}
                <span className="badge success">Rejada {group.onTrack}</span>
              </div>
            </header>

            <div className="lx-stack">
              {group.courses.map((course) => {
                const open = openCourse === course.id;
                return (
                  <article key={course.id} className={`admin-course-card${open ? " is-open" : ""}`}>
                    <button
                      type="button"
                      className="admin-course-main"
                      onClick={() => setOpenCourse(open ? null : course.id)}
                      aria-expanded={open}
                    >
                      <div className="admin-course-title">
                        <h4>{course.titleUz}</h4>
                        <p className="small muted" style={{ margin: 0 }}>
                          {course.subjectName} · {course.lessonCount} dars · {course.activeStudents} faol / {course.totalSubs} obuna
                        </p>
                      </div>
                      <span className={`badge ${healthTone(course.health)}`}>{healthLabel(course.health)}</span>
                      <div className="admin-course-metrics">
                        <span>
                          <b>{course.attendancePct == null ? "—" : `${course.attendancePct}%`}</b>
                          <small>Davomat</small>
                        </span>
                        <span>
                          <b>{course.scheduledCount}</b>
                          <small>Reja</small>
                        </span>
                        <span>
                          <b>{course.endedCount}</b>
                          <small>Yozuv</small>
                        </span>
                      </div>
                    </button>
                    <SoftExpand open={open}>
                      <div className="admin-course-detail">
                        <div className="account-facts">
                          <div>
                            <div className="small muted">Keyingi dars</div>
                            <div>
                              {course.nextLessonTitle
                                ? `${course.nextLessonTitle} · ${formatWhen(course.nextLessonAt)}`
                                : "Yo'q"}
                            </div>
                          </div>
                          <div>
                            <div className="small muted">Oxirgi dars</div>
                            <div>
                              {course.lastLessonTitle
                                ? `${course.lastLessonTitle} · ${formatWhen(course.lastLessonAt)}`
                                : "Yo'q"}
                            </div>
                          </div>
                          <div>
                            <div className="small muted">Faol qatnashuvchi</div>
                            <div>{course.activeAttendees} / {course.activeStudents}</div>
                          </div>
                          <div>
                            <div className="small muted">To&apos;lov</div>
                            <div>{formatSom(course.paymentSum)} · {course.paymentCount} ta</div>
                          </div>
                          <div>
                            <div className="small muted">Narx 1/2/3</div>
                            <div className="small">
                              {formatSom(course.priceT1)} / {formatSom(course.priceT2)} / {formatSom(course.priceT3)}
                            </div>
                          </div>
                          <div>
                            <div className="small muted">Holat</div>
                            <div>{course.isPublished ? "Nashrda" : "Yashirin"}</div>
                          </div>
                        </div>
                        <p className="small muted" style={{ margin: 0 }}>
                          {course.health === "empty"
                            ? "O'qituvchi hali dars rejasiga mavzu qo'ymagan."
                            : course.health === "on_track"
                              ? "Reja bor — o'quvchi jadvalda ko'radi."
                              : course.health === "live"
                                ? "Hozir efir ketmoqda."
                                : course.health === "stale"
                                  ? "14+ kun yangi reja yo'q."
                                  : "Darslar bor, lekin yaqin reja yo'q."}
                        </p>
                      </div>
                    </SoftExpand>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
        {visibleGroups.length === 0 ? <div className="empty">Kurs topilmadi.</div> : null}
      </div>
    </div>
  );
}
