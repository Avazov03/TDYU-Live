type Point = { label: string; value: number };

export function AdminBarChart({
  data,
  height = 140,
  formatValue,
}: {
  data: Point[];
  height?: number;
  formatValue?: (n: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const showEvery = data.length > 14 ? 5 : data.length > 8 ? 2 : 1;

  return (
    <div className="admin-chart">
      <div className="admin-bars" style={{ height }}>
        {data.map((point, index) => (
          <div key={`${point.label}-${index}`} className="admin-bar-col" title={`${point.label}: ${formatValue ? formatValue(point.value) : point.value}`}>
            <div
              className="admin-bar"
              style={{ height: `${Math.max(4, (point.value / max) * 100)}%` }}
            />
            {index % showEvery === 0 ? <span className="admin-bar-label">{point.label}</span> : <span className="admin-bar-label" />}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminDonut({
  segments,
}: {
  segments: { label: string; value: number; tone: "t1" | "t2" | "t3" | "muted" }[];
}) {
  const total = segments.reduce((n, s) => n + s.value, 0) || 1;
  let offset = 0;
  const colors: Record<string, string> = {
    t1: "var(--text-3)",
    t2: "var(--accent)",
    t3: "var(--success)",
    muted: "var(--border)",
  };

  return (
    <div className="admin-donut-wrap">
      <svg viewBox="0 0 42 42" className="admin-donut" aria-hidden>
        <circle cx="21" cy="21" r="15.5" fill="transparent" stroke="var(--border)" strokeWidth="5" />
        {segments.map((seg) => {
          const len = (seg.value / total) * 97.4;
          const circle = (
            <circle
              key={seg.label}
              cx="21"
              cy="21"
              r="15.5"
              fill="transparent"
              stroke={colors[seg.tone]}
              strokeWidth="5"
              strokeDasharray={`${len} ${97.4 - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += len;
          return circle;
        })}
        <text x="21" y="22.5" textAnchor="middle" className="admin-donut-total">
          {segments.reduce((n, s) => n + s.value, 0)}
        </text>
      </svg>
      <ul className="admin-donut-legend">
        {segments.map((seg) => (
          <li key={seg.label}>
            <span className={`admin-dot tone-${seg.tone}`} />
            <span>{seg.label}</span>
            <b>{seg.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminHBar({
  rows,
}: {
  rows: { label: string; sub?: string; value: number }[];
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  if (rows.length === 0) return <p className="small muted">Hali ma&apos;lumot yo&apos;q.</p>;
  return (
    <div className="admin-hbar-list">
      {rows.map((row) => (
        <div key={row.label} className="admin-hbar-row">
          <div className="admin-hbar-meta">
            <span>{row.label}</span>
            {row.sub ? <span className="small muted">{row.sub}</span> : null}
            <b>{row.value}</b>
          </div>
          <div className="admin-hbar-track">
            <div className="admin-hbar-fill" style={{ width: `${(row.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
