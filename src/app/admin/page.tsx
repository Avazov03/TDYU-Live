import Link from "next/link";
import { AdminBarChart, AdminDonut, AdminHBar } from "@/components/admin/AdminCharts";
import { BadgeCheck, GraduationCap, Presentation, Radio, Wallet } from "lucide-react";
import { getAdminDashboard } from "@/lib/admin-stats";
import { getAdminReviewQueue } from "@/lib/admin-courses";
import { lifecycleLabel } from "@/lib/course-review-policy";
import { isCourseReviewV1Enabled } from "@/lib/feature-flags";
import { formatSom } from "@/lib/tariffs";
import { formatDateTime, fmt } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const reviewFlow = isCourseReviewV1Enabled();
  const [data, review] = await Promise.all([
    getAdminDashboard(),
    reviewFlow ? getAdminReviewQueue() : Promise.resolve([]),
  ]);
  const { kpis, seatMode, tiers, seats, registrationsByDay, revenueByDay, lessonStatus, topCourses, attention } = data;
  const reviewPending = review.filter((c) =>
    c.lifecycleStatus === "submitted" || c.lifecycleStatus === "in_review" || c.lifecycleStatus === "approved",
  );
  const hasAttention =
    reviewPending.length > 0 ||
    attention.live.length > 0 ||
    attention.invites.length > 0 ||
    attention.expiring.length > 0;

  return (
    <div className="admin-board">
      <header className="lx-mc-head lx-admin-head">
        <div>
          <p className="lx-kicker">Boshqaruv</p>
          <h1 className="lx-mc-title">Bugun platformada</h1>
          <p className="lx-mc-sub">
            {fmt(kpis.courses)} ta kurs · {fmt(kpis.students)} ta o‘quvchi · {fmt(kpis.teachers)} ta o‘qituvchi
          </p>
        </div>
      </header>

      <div className="lx-admin-stats">
        <Link href="/admin/users" className="lx-today-stat">
          <span className="lx-today-stat-icon">
            <GraduationCap size={18} aria-hidden />
          </span>
          <span className="lx-today-stat-num">{fmt(kpis.students)}</span>
          <span className="lx-today-stat-label">O‘quvchi</span>
        </Link>
        <Link
          href="/admin/teachers"
          className={`lx-today-stat${kpis.teachersPending > 0 ? " is-alert" : ""}`}
        >
          <span className="lx-today-stat-icon">
            <Presentation size={18} aria-hidden />
          </span>
          <span className="lx-today-stat-num">{fmt(kpis.teachers)}</span>
          <span className="lx-today-stat-label">
            O‘qituvchi{kpis.teachersPending > 0 ? ` · ${kpis.teachersPending} taklif kutilmoqda` : ""}
          </span>
        </Link>
        <Link href="/admin/users" className="lx-today-stat">
          <span className="lx-today-stat-icon">
            <BadgeCheck size={18} aria-hidden />
          </span>
          <span className="lx-today-stat-num">{fmt(seatMode ? kpis.openSeats : kpis.activeSubs)}</span>
          <span className="lx-today-stat-label">{seatMode ? "Faol o‘rin" : "Faol obuna"}</span>
        </Link>
        <Link href="/admin/payments" className="lx-today-stat">
          <span className="lx-today-stat-icon">
            <Wallet size={18} aria-hidden />
          </span>
          <span className="lx-today-stat-num">{formatSom(kpis.monthRevenue)}</span>
          <span className="lx-today-stat-label">
            Shu oy daromad
            {kpis.monthDemo > 0 ? (
              <small className="lx-demo-note" data-testid="admin-demo-month">
                Demo: {formatSom(kpis.monthDemo)} — daromadga kirmaydi
              </small>
            ) : null}
          </span>
        </Link>
        <Link href="/admin/courses" className={`lx-today-stat${kpis.live > 0 ? " is-live" : ""}`}>
          <span className="lx-today-stat-icon">
            <Radio size={18} aria-hidden />
          </span>
          <span className="lx-today-stat-num">{fmt(kpis.live)}</span>
          <span className="lx-today-stat-label">Hozir jonli</span>
        </Link>
      </div>

      {hasAttention ? (
        <section className="admin-attention">
          <h2 className="lx-cd-h2">Diqqat</h2>
          <div className="admin-attention-grid">
            {reviewPending.length > 0 ? (
              <div className="admin-attention-card" data-testid="attention-review">
                <p className="lx-kicker">Tekshiruv · {reviewPending.length} ta</p>
                <div className="lx-stack">
                  {reviewPending.slice(0, 3).map((item) => (
                    <Link key={item.id} href="/admin/review" className="lx-row" style={{ padding: 10 }}>
                      <div>
                        <h3 style={{ fontSize: 14 }}>{item.titleUz}</h3>
                        <p className="small muted" style={{ margin: 0 }}>
                          {item.teacherName} · {lifecycleLabel(item.lifecycleStatus)}
                        </p>
                      </div>
                      <span className="lx-go">Ochish</span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            {attention.live.length > 0 ? (
              <div className="admin-attention-card">
                <p className="lx-kicker">Jonli efir</p>
                <div className="lx-stack">
                  {attention.live.map((item) => (
                    <div key={item.id} className="lx-row" style={{ padding: 10 }}>
                      <div>
                        <h3 style={{ fontSize: 14 }}>{item.title}</h3>
                        <p className="small muted" style={{ margin: 0 }}>
                          {item.teacher} · {item.course}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {attention.invites.length > 0 ? (
              <div className="admin-attention-card">
                <p className="lx-kicker">Invite ochiq</p>
                <div className="lx-stack">
                  {attention.invites.map((item) => (
                    <Link key={item.id} href="/admin/teachers" className="lx-row" style={{ padding: 10 }}>
                      <div>
                        <h3 style={{ fontSize: 14 }}>{item.teacher}</h3>
                        <p className="small muted" style={{ margin: 0 }}>
                          gacha {formatDateTime(new Date(item.expiresAt))}
                        </p>
                      </div>
                      <span className="lx-go">Ochish</span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            {attention.expiring.length > 0 ? (
              <div className="admin-attention-card">
                <p className="lx-kicker">7 kunda tugaydi</p>
                <div className="lx-stack">
                  {attention.expiring.map((item) => (
                    <div key={item.id} className="lx-row" style={{ padding: 10 }}>
                      <div>
                        <h3 style={{ fontSize: 14 }}>{item.student}</h3>
                        <p className="small muted" style={{ margin: 0 }}>
                          {item.course} · {item.teacher} · {formatDateTime(new Date(item.endsAt))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="admin-charts-grid">
        <section className="admin-panel">
          <div className="admin-panel-head">
            <h3>Yangi o&apos;quvchilar · 30 kun</h3>
            <span className="small muted">{registrationsByDay.reduce((n, d) => n + d.value, 0)} ta</span>
          </div>
          <AdminBarChart data={registrationsByDay} />
        </section>

        <section className="admin-panel">
          {seatMode ? (
            <>
              <div className="admin-panel-head">
                <h3>Kurs o‘rinlari</h3>
                <span className="small muted">{kpis.openSeats} o‘rin</span>
              </div>
              <AdminDonut
                segments={[
                  { label: "Faol", value: seats.active, tone: "t2" },
                  { label: "Yakunlangan", value: seats.completed, tone: "t3" },
                ]}
              />
            </>
          ) : (
            <>
              <div className="admin-panel-head">
                <h3>Faol tariflar</h3>
                <span className="small muted">{kpis.activeSubs} obuna</span>
              </div>
              <AdminDonut
                segments={[
                  { label: "1 — Yozuv", value: tiers.t1, tone: "t1" },
                  { label: "2 — Jonli", value: tiers.t2, tone: "t2" },
                  { label: "3 — Premium", value: tiers.t3, tone: "t3" },
                ]}
              />
            </>
          )}
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <h3>Daromad · 30 kun</h3>
            <span className="small muted">
              {formatSom(revenueByDay.reduce((n, d) => n + d.value, 0))}
            </span>
          </div>
          <AdminBarChart data={revenueByDay} valueFormat="som" />
          {data.demo30 > 0 ? (
            <p className="small muted lx-demo-note">Demo: {formatSom(data.demo30)} — daromadga kirmaydi</p>
          ) : null}
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <h3>Darslar · ±7 kun</h3>
          </div>
          <AdminDonut
            segments={[
              { label: "Jonli", value: lessonStatus.live, tone: "t3" },
              { label: "Kutish", value: lessonStatus.lobby, tone: "t2" },
              { label: "Reja", value: lessonStatus.scheduled, tone: "t2" },
              { label: "Yozuv", value: lessonStatus.ended, tone: "t1" },
            ]}
          />
        </section>

        <section className="admin-panel admin-panel-wide">
          <div className="admin-panel-head">
            <h3>Top kurslar · faol o&apos;quvchi</h3>
            <Link href="/admin/courses" className="small">Barchasi</Link>
          </div>
          <AdminHBar
            rows={topCourses.map((c) => ({
              label: c.title,
              sub: c.teacher,
              value: c.activeStudents,
            }))}
          />
        </section>
      </div>
    </div>
  );
}
