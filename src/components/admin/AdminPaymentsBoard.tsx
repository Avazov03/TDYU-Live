"use client";

import { useMemo, useState } from "react";
import { RoleAvatar } from "@/components/admin/RoleAvatar";
import { AdminBarChart, AdminDonut } from "@/components/admin/AdminCharts";
import { Icon } from "@/components/ui/Icon";
import { AdminRefundCell, type AdminRefundInfo } from "@/components/admin/AdminRefundCell";
import { TARIFF_LABELS, TARIFF_SHORT, formatSom } from "@/lib/tariffs";
import { formatDateTime } from "@/lib/utils";
import { isRealRevenuePayment, splitRevenue } from "@/lib/revenue";
import type { PaymentStatus, TariffTier } from "@/generated/prisma/client";

export type AdminPaymentRow = {
  id: string;
  studentName: string;
  studentEmail?: string;
  courseTitle: string | null;
  teacherName: string | null;
  /** Null for course purchases — their payment row stores only a placeholder tier. */
  tier: TariffTier | null;
  amount: number;
  status: PaymentStatus;
  isDemo: boolean;
  provider: string;
  createdAt: string;
  /** Set only when FF_REFUNDS_V1 is on and the payment belongs to a course purchase. */
  refund?: AdminRefundInfo;
};

function statusLabel(status: PaymentStatus) {
  if (status === "demo_paid") return "Demo to'langan";
  if (status === "paid") return "To'langan";
  if (status === "failed") return "Muvaffaqiyatsiz";
  return "Kutilmoqda";
}

function statusTone(status: PaymentStatus) {
  if (status === "paid" || status === "demo_paid") return "success";
  if (status === "failed") return "danger";
  return "pending";
}

type StatusFilter = "all" | PaymentStatus;
type TierFilter = "all" | TariffTier | "course";
type RangeFilter = "14" | "30" | "month" | "all";

export function AdminPaymentsBoard({
  payments,
  chart14,
  demo14,
  canSeeSecrets,
}: {
  payments: AdminPaymentRow[];
  chart14: { label: string; value: number }[];
  demo14: number;
  canSeeSecrets: boolean;
}) {
  const showRefunds = payments.some((p) => p.refund);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [tier, setTier] = useState<TierFilter>("all");
  const [range, setRange] = useState<RangeFilter>("month");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return payments.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (tier === "course" ? p.tier !== null : tier !== "all" && p.tier !== tier) return false;
      const at = new Date(p.createdAt);
      if (range === "14" && at < new Date(now.getTime() - 14 * 86_400_000)) return false;
      if (range === "30" && at < new Date(now.getTime() - 30 * 86_400_000)) return false;
      if (range === "month" && at < monthStart) return false;
      if (!q) return true;
      return `${p.studentName} ${p.studentEmail ?? ""} ${p.courseTitle ?? ""} ${p.teacherName ?? ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [payments, query, status, tier, range]);

  const paid = filtered.filter((p) => p.status === "paid" || p.status === "demo_paid");
  const real = paid.filter(isRealRevenuePayment);
  const { real: sum, demo: demoSum } = splitRevenue(paid);
  const byTier = { t1: 0, t2: 0, t3: 0 };
  let byCourse = 0;
  for (const p of real) {
    if (p.tier) byTier[p.tier] += p.amount;
    else byCourse += p.amount;
  }
  const failed = filtered.filter((p) => p.status === "failed").length;
  const pending = filtered.filter((p) => p.status === "pending").length;

  const byTeacher = new Map<string, number>();
  for (const p of real) {
    const key = p.teacherName || "Kurssiz";
    byTeacher.set(key, (byTeacher.get(key) ?? 0) + p.amount);
  }
  const teacherRows = [...byTeacher.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value]) => ({ label, value }));

  return (
    <div className="admin-board">
      <header className="lx-mc-head lx-admin-head">
        <div>
          <p className="lx-kicker">To‘lovlar</p>
          <h1 className="lx-mc-title">To‘lovlar</h1>
          <p className="lx-mc-sub">Kirim, holat va qaytarishlar — tanlangan filtr bo‘yicha.</p>
        </div>
      </header>

      <div className="admin-summary">
        <div className="stat-card">
          <div className="small muted">Filtr daromad</div>
          <div className="num" style={{ fontSize: 20 }}>{formatSom(sum)}</div>
          <div className="small muted">{paid.length} ta muvaffaqiyatli</div>
          {demoSum > 0 ? (
            <div className="lx-demo-note" data-testid="admin-demo-filter">
              Demo: {formatSom(demoSum)} — daromadga kirmaydi
            </div>
          ) : null}
        </div>
        <div className="stat-card">
          <div className="small muted">1 / 2 / 3-tarif</div>
          <div className="num" style={{ fontSize: 14, marginTop: 8 }}>
            {formatSom(byTier.t1)} · {formatSom(byTier.t2)} · {formatSom(byTier.t3)}
          </div>
          {byCourse > 0 ? <div className="small muted">Kurs xaridi: {formatSom(byCourse)}</div> : null}
        </div>
        <div className="stat-card">
          <div className="small muted">Kutilmoqda</div>
          <div className="num">{pending}</div>
        </div>
        <div className="stat-card">
          <div className="small muted">Muvaffaqiyatsiz</div>
          <div className="num">{failed}</div>
        </div>
      </div>

      <div className="admin-charts-grid">
        <section className="admin-panel">
          <div className="admin-panel-head">
            <h3>14 kunlik daromad</h3>
            <span className="small muted">{formatSom(chart14.reduce((n, d) => n + d.value, 0))}</span>
          </div>
          <AdminBarChart data={chart14} valueFormat="som" />
          {demo14 > 0 ? (
            <p className="small muted lx-demo-note">Demo: {formatSom(demo14)} — daromadga kirmaydi</p>
          ) : null}
        </section>
        <section className="admin-panel">
          <div className="admin-panel-head">
            <h3>Filtrdagi tariflar</h3>
          </div>
          <AdminDonut
            segments={[
              { label: TARIFF_SHORT.t1, value: paid.filter((p) => p.tier === "t1").length, tone: "t1" },
              { label: TARIFF_SHORT.t2, value: paid.filter((p) => p.tier === "t2").length, tone: "t2" },
              { label: TARIFF_SHORT.t3, value: paid.filter((p) => p.tier === "t3").length, tone: "t3" },
              { label: "Kurs xaridi", value: paid.filter((p) => p.tier === null).length, tone: "muted" },
            ]}
          />
        </section>
      </div>

      {teacherRows.length > 0 ? (
        <section className="admin-panel">
          <div className="admin-panel-head">
            <h3>O&apos;qituvchi bo&apos;yicha (filtr)</h3>
          </div>
          <div className="admin-pay-teachers">
            {teacherRows.map((row) => (
              <div key={row.label} className="admin-pay-teacher">
                <RoleAvatar name={row.label} role="teacher" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{row.label}</div>
                  <div className="small muted">{formatSom(row.value)}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="staff-toolbar">
        <div className="staff-search">
          <Icon name="search" size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={canSeeSecrets ? "O'quvchi, email, kurs, o'qituvchi..." : "O'quvchi, kurs, o'qituvchi..."}
            aria-label="To‘lovni qidirish"
          />
        </div>
        <select className="staff-filter" aria-label="Davr bo‘yicha filtr" value={range} onChange={(e) => setRange(e.target.value as RangeFilter)}>
          <option value="month">Shu oy</option>
          <option value="14">14 kun</option>
          <option value="30">30 kun</option>
          <option value="all">Barchasi</option>
        </select>
        <select className="staff-filter" aria-label="Holat bo‘yicha filtr" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
          <option value="all">Barcha holat</option>
          <option value="demo_paid">Demo</option>
          <option value="paid">To&apos;langan</option>
          <option value="pending">Kutilmoqda</option>
          <option value="failed">Muvaffaqiyatsiz</option>
        </select>
        <select className="staff-filter" aria-label="Tarif bo‘yicha filtr" value={tier} onChange={(e) => setTier(e.target.value as TierFilter)}>
          <option value="all">Barcha tarif</option>
          <option value="t1">{TARIFF_SHORT.t1}</option>
          <option value="t2">{TARIFF_SHORT.t2}</option>
          <option value="t3">{TARIFF_SHORT.t3}</option>
          <option value="course">Kurs xaridi</option>
        </select>
      </div>

      <div className="admin-table-wrap card" style={{ padding: 0 }}>
        <table className="staff-table">
          <thead>
            <tr>
              <th>O&apos;quvchi</th>
              <th>Kurs</th>
              <th>O&apos;qituvchi</th>
              <th>Tarif</th>
              <th>Summa</th>
              <th>Holat</th>
              <th>Sana</th>
              {showRefunds ? <th>Qaytarish</th> : null}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} style={{ cursor: "default" }}>
                <td>
                  <div className="staff-name">
                    <RoleAvatar name={p.studentName} role="student" />
                    <span>
                      {p.studentName}
                      {p.studentEmail ? <div className="small muted">{p.studentEmail}</div> : null}
                    </span>
                  </div>
                </td>
                <td className="lx-pay-course">{p.courseTitle ?? "Tarif (kurs keyin)"}</td>
                <td className="small muted">{p.teacherName ?? "—"}</td>
                <td className="lx-pay-nowrap">{p.tier ? TARIFF_LABELS[p.tier] : "Kurs xaridi"}</td>
                <td className="lx-pay-nowrap lx-pay-amount">{formatSom(p.amount)}</td>
                <td className="lx-pay-nowrap">
                  <span className={`badge ${statusTone(p.status)}`}>{statusLabel(p.status)}</span>
                  <div className="small muted">{p.provider}</div>
                </td>
                <td className="small muted lx-pay-nowrap">{formatDateTime(new Date(p.createdAt))}</td>
                {showRefunds ? (
                  <td className="lx-pay-refund">{p.refund ? <AdminRefundCell info={p.refund} /> : null}</td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? <div className="empty">To&apos;lov topilmadi.</div> : null}
      </div>
    </div>
  );
}
