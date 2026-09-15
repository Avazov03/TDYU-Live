import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { viewerCanSeeCredentials } from "@/lib/super-admin";
import { TARIFF_LABELS, formatSom } from "@/lib/tariffs";
import { formatDateTime } from "@/lib/utils";
import { AdminBarChart } from "@/components/admin/AdminCharts";

export const dynamic = "force-dynamic";

function dayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dayLabel(date: Date) {
  return new Intl.DateTimeFormat("uz-UZ", {
    timeZone: "Asia/Tashkent",
    day: "numeric",
    month: "short",
  }).format(date);
}

export default async function AdminPaymentsPage() {
  const session = await auth();
  const canSeeSecrets = await viewerCanSeeCredentials(session?.user?.id, session?.user?.role);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const days14 = new Date(now.getTime() - 13 * 86_400_000);

  const payments = await prisma.payment.findMany({
    include: {
      user: {
        select: canSeeSecrets
          ? { fullName: true, email: true, role: true }
          : { fullName: true, role: true },
      },
      course: { select: { titleUz: true, teacher: { select: { fullName: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 150,
  });

  const paid = payments.filter((p) => p.status === "demo_paid" || p.status === "paid");
  const monthPaid = paid.filter((p) => p.createdAt >= monthStart);
  const monthSum = monthPaid.reduce((n, p) => n + p.amount, 0);
  const totalSum = paid.reduce((n, p) => n + p.amount, 0);

  const byTier = { t1: 0, t2: 0, t3: 0 };
  for (const p of monthPaid) byTier[p.tier] += p.amount;

  const buckets = new Map<string, { label: string; value: number }>();
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * 86_400_000);
    const key = dayKey(d);
    buckets.set(key, { label: dayLabel(d), value: 0 });
  }
  for (const p of paid) {
    if (p.createdAt < days14) continue;
    const key = dayKey(p.createdAt);
    const row = buckets.get(key);
    if (row) row.value += p.amount;
  }

  const statusTone = (status: string) => {
    if (status === "paid" || status === "demo_paid") return "success";
    if (status === "failed") return "danger";
    return "pending";
  };

  const statusLabel = (status: string) => {
    if (status === "demo_paid") return "Demo to'langan";
    if (status === "paid") return "To'langan";
    if (status === "failed") return "Muvaffaqiyatsiz";
    return "Kutilmoqda";
  };

  return (
    <div className="admin-board">
      <div className="lx-board">
        <p className="lx-kicker">To&apos;lovlar</p>
        <h2>Kirim va tarix</h2>
        <p className="muted small lx-lead">
          Summalar bazadagi amount bo&apos;yicha. Hozir ko&apos;p yozuvlar demo to&apos;lov.
        </p>
      </div>

      <div className="admin-summary">
        <div className="stat-card">
          <div className="small muted">Shu oy</div>
          <div className="num" style={{ fontSize: 20 }}>{formatSom(monthSum)}</div>
          <div className="small muted">{monthPaid.length} ta to&apos;lov</div>
        </div>
        <div className="stat-card">
          <div className="small muted">Ko&apos;rsatilgan jami</div>
          <div className="num" style={{ fontSize: 20 }}>{formatSom(totalSum)}</div>
        </div>
        <div className="stat-card">
          <div className="small muted">1 / 2 / 3-tarif (oy)</div>
          <div className="num" style={{ fontSize: 15, marginTop: 8 }}>
            {formatSom(byTier.t1)} · {formatSom(byTier.t2)} · {formatSom(byTier.t3)}
          </div>
        </div>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h3>14 kunlik to&apos;lov</h3>
          <span className="small muted">{formatSom([...buckets.values()].reduce((n, d) => n + d.value, 0))}</span>
        </div>
        <AdminBarChart data={[...buckets.values()]} formatValue={formatSom} />
      </section>

      <div className="admin-table-wrap card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>O&apos;quvchi</th>
              <th>Kurs / o&apos;qituvchi</th>
              <th>Tarif</th>
              <th>Summa</th>
              <th>Holat</th>
              <th>Sana</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.user.fullName}
                  {canSeeSecrets && "email" in p.user && typeof p.user.email === "string" ? (
                    <div className="small muted">{p.user.email}</div>
                  ) : null}
                </td>
                <td>
                  {p.course?.titleUz ?? "Tarif (kurs keyin)"}
                  {p.course?.teacher ? (
                    <div className="small muted">{p.course.teacher.fullName}</div>
                  ) : null}
                </td>
                <td>{TARIFF_LABELS[p.tier]}</td>
                <td>{formatSom(p.amount)}</td>
                <td>
                  <span className={`badge ${statusTone(p.status)}`}>{statusLabel(p.status)}</span>
                </td>
                <td className="small muted">{formatDateTime(p.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {payments.length === 0 ? <div className="empty">To&apos;lov yo&apos;q.</div> : null}
      </div>
    </div>
  );
}
