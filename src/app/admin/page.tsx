import Link from "next/link";
import { AdminBarChart, AdminDonut, AdminHBar } from "@/components/admin/AdminCharts";
import { getAdminDashboard } from "@/lib/admin-stats";
import { formatSom } from "@/lib/tariffs";
import { formatDateTime, fmt } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const data = await getAdminDashboard();
  const { kpis, tiers, registrationsByDay, revenueByDay, lessonStatus, topCourses, attention } = data;
  const hasAttention =
    attention.live.length > 0 || attention.invites.length > 0 || attention.expiring.length > 0;

  return (
    <div className="admin-board">
      <div className="lx-board" style={{ marginBottom: 8 }}>
        <p className="lx-kicker">Boshqaruv</p>
        <h2>Bugun platformada</h2>
        <p className="muted small lx-lead">
          O&apos;quvchi, o&apos;qituvchi va to&apos;lovlar ajratilgan. Raqamlar baza bilan bir xil.
        </p>
      </div>

      <div className="kpi-grid">
        <Link href="/admin/users" className="stat-card stat-link">
          <div className="small muted">O&apos;quvchilar</div>
          <div className="num">{fmt(kpis.students)}</div>
        </Link>
        <Link href="/admin/teachers" className="stat-card stat-link">
          <div className="small muted">O&apos;qituvchilar</div>
          <div className="num">{fmt(kpis.teachers)}</div>
          {kpis.teachersPending > 0 ? (
            <div className="small muted">{kpis.teachersPending} ta invite kutilmoqda</div>
          ) : null}
        </Link>
        <div className="stat-card">
          <div className="small muted">Faol obuna</div>
          <div className="num">{fmt(kpis.activeSubs)}</div>
        </div>
        <Link href="/admin/payments" className="stat-card stat-link">
          <div className="small muted">Shu oy to&apos;lov</div>
          <div className="num" style={{ fontSize: 22 }}>{formatSom(kpis.monthRevenue)}</div>
        </Link>
        <div className="stat-card">
          <div className="small muted">Hozir jonli</div>
          <div className="num">{fmt(kpis.live)}</div>
        </div>
      </div>

      {hasAttention ? (
        <section className="admin-attention">
          <h3>Diqqat</h3>
          <div className="admin-attention-grid">
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
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <h3>To&apos;lovlar · 30 kun</h3>
            <span className="small muted">
              {formatSom(revenueByDay.reduce((n, d) => n + d.value, 0))}
            </span>
          </div>
          <AdminBarChart data={revenueByDay} valueFormat="som" />
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <h3>Darslar · ±7 kun</h3>
          </div>
          <AdminDonut
            segments={[
              { label: "Jonli", value: lessonStatus.live, tone: "t3" },
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
