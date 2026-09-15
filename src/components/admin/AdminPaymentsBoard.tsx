"use client";

import { useMemo, useState } from "react";
import { RoleAvatar } from "@/components/admin/RoleAvatar";
import { AdminBarChart, AdminDonut } from "@/components/admin/AdminCharts";
import { Icon } from "@/components/ui/Icon";
import { TARIFF_LABELS, TARIFF_SHORT, formatSom } from "@/lib/tariffs";
import type { PaymentStatus, TariffTier } from "@/generated/prisma/client";

export type AdminPaymentRow = {
  id: string;
  studentName: string;
  studentEmail?: string;
  courseTitle: string | null;
  teacherName: string | null;
  tier: TariffTier;
  amount: number;
  status: PaymentStatus;
  provider: string;
  createdAt: string;
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

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("uz-UZ", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

type StatusFilter = "all" | PaymentStatus;
type TierFilter = "all" | TariffTier;
type RangeFilter = "14" | "30" | "month" | "all";

export function AdminPaymentsBoard({
  payments,
  chart14,
  canSeeSecrets,
}: {
  payments: AdminPaymentRow[];
  chart14: { label: string; value: number }[];
  canSeeSecrets: boolean;
}) {
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
      if (tier !== "all" && p.tier !== tier) return false;
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
  const sum = paid.reduce((n, p) => n + p.amount, 0);
  const byTier = { t1: 0, t2: 0, t3: 0 };
  for (const p of paid) byTier[p.tier] += p.amount;
  const failed = filtered.filter((p) => p.status === "failed").length;
  const pending = filtered.filter((p) => p.status === "pending").length;

  const byTeacher = new Map<string, number>();
  for (const p of paid) {
    const key = p.teacherName || "Kurssiz";
    byTeacher.set(key, (byTeacher.get(key) ?? 0) + p.amount);
  }
  const teacherRows = [...byTeacher.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value]) => ({ label, value }));

  return (
    <div className="admin-board">
      <div className="staff-head">
        <div>
          <p className="lx-kicker" style={{ marginBottom: 4 }}>To&apos;lovlar</p>
          <h2>Kirim oqimi</h2>
          <p className="small muted" style={{ marginTop: 4 }}>
            Filtrlangan ko&apos;rinishdagi summa va holat. Hover bilan kunlik ustunlar.
          </p>
        </div>
      </div>

      <div className="admin-summary">
        <div className="stat-card">
          <div className="small muted">Filtr summa</div>
          <div className="num" style={{ fontSize: 20 }}>{formatSom(sum)}</div>
          <div className="small muted">{paid.length} ta muvaffaqiyatli</div>
        </div>
        <div className="stat-card">
          <div className="small muted">1 / 2 / 3-tarif</div>
          <div className="num" style={{ fontSize: 14, marginTop: 8 }}>
            {formatSom(byTier.t1)} · {formatSom(byTier.t2)} · {formatSom(byTier.t3)}
          </div>
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
            <h3>14 kunlik to&apos;lov</h3>
            <span className="small muted">{formatSom(chart14.reduce((n, d) => n + d.value, 0))}</span>
          </div>
          <AdminBarChart data={chart14} formatValue={formatSom} />
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
          />
        </div>
        <select className="staff-filter" value={range} onChange={(e) => setRange(e.target.value as RangeFilter)}>
          <option value="month">Shu oy</option>
          <option value="14">14 kun</option>
          <option value="30">30 kun</option>
          <option value="all">Barchasi</option>
        </select>
        <select className="staff-filter" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
          <option value="all">Barcha holat</option>
          <option value="demo_paid">Demo</option>
          <option value="paid">To&apos;langan</option>
          <option value="pending">Kutilmoqda</option>
          <option value="failed">Muvaffaqiyatsiz</option>
        </select>
        <select className="staff-filter" value={tier} onChange={(e) => setTier(e.target.value as TierFilter)}>
          <option value="all">Barcha tarif</option>
          <option value="t1">{TARIFF_SHORT.t1}</option>
          <option value="t2">{TARIFF_SHORT.t2}</option>
          <option value="t3">{TARIFF_SHORT.t3}</option>
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
                <td>{p.courseTitle ?? "Tarif (kurs keyin)"}</td>
                <td className="small muted">{p.teacherName ?? "—"}</td>
                <td>{TARIFF_LABELS[p.tier]}</td>
                <td>{formatSom(p.amount)}</td>
                <td>
                  <span className={`badge ${statusTone(p.status)}`}>{statusLabel(p.status)}</span>
                  <div className="small muted">{p.provider}</div>
                </td>
                <td className="small muted">{formatWhen(p.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? <div className="empty">To&apos;lov topilmadi.</div> : null}
      </div>
    </div>
  );
}
