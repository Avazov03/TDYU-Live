import { prisma } from "@/lib/prisma";
import { TARIFF_LABELS, formatSom } from "@/lib/tariffs";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const payments = await prisma.payment.findMany({
    include: {
      user: { select: { fullName: true, email: true } },
      course: { select: { titleUz: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <>
      <h2 style={{ marginBottom: 16 }}>To&apos;lovlar (demo)</h2>
      <div className="admin-table-wrap card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>O&apos;quvchi</th>
              <th>Kurs</th>
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
                  <div className="small muted">{p.user.email}</div>
                </td>
                <td>{p.course?.titleUz ?? "Tarif (o'qituvchi keyin)"}</td>
                <td>{TARIFF_LABELS[p.tier]}</td>
                <td>{formatSom(p.amount)}</td>
                <td>
                  <span className="badge success">{p.status}</span>
                </td>
                <td className="small muted">{formatDateTime(p.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
