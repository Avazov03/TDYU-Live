import { collectSystemHealth } from "@/lib/system-health";

export const dynamic = "force-dynamic";

export default async function AdminHealthPage() {
  const health = await collectSystemHealth();

  return (
    <div className="admin-board">
      <header className="lx-mc-head lx-admin-head">
        <div>
          <p className="lx-kicker">Infratuzilma</p>
          <h1 className="lx-mc-title">Tizim holati</h1>
          <p className="lx-mc-sub">
            Tekshiruv vaqti: {health.checkedAt}. Yashil faqat shu so‘rov muvaffaqiyatli bo‘lsa.
          </p>
        </div>
      </header>
      <ul className="card" style={{ listStyle: "none", margin: 0, padding: 16, display: "grid", gap: 12 }}>
        {health.checks.map((check) => (
          <li key={check.id} data-testid={`health-${check.id}`}>
            <strong>
              {check.ok === true ? "Yaxshi" : check.ok === false ? "Muammo" : "O‘lchanmagan"}
              {" · "}
              {check.label}
            </strong>
            <p className="small muted" style={{ margin: "4px 0 0" }}>
              {check.detail}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
