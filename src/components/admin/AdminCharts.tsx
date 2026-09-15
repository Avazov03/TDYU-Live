"use client";

import { useId, useState } from "react";
import { formatSom } from "@/lib/tariffs";

type Point = { label: string; value: number };
type ValueFormat = "number" | "som";

function formatPoint(value: number, format: ValueFormat = "number") {
  if (format === "som") return formatSom(value);
  return String(value);
}

function tipText(label: string, value: number, format: ValueFormat = "number", unitLabel?: string) {
  const formatted = formatPoint(value, format);
  return unitLabel && format === "number" ? `${label}: ${formatted} ${unitLabel}` : `${label}: ${formatted}`;
}

export function AdminBarChart({
  data,
  height = 148,
  valueFormat = "number",
  unitLabel,
}: {
  data: Point[];
  height?: number;
  valueFormat?: ValueFormat;
  unitLabel?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const showEvery = data.length > 14 ? 5 : data.length > 8 ? 2 : 1;
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);

  return (
    <div className="admin-chart" onMouseLeave={() => setTip(null)}>
      <div className="admin-bars" style={{ height }}>
        {data.map((point, index) => (
          <div
            key={`${point.label}-${index}`}
            className="admin-bar-col"
            onMouseEnter={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const parent = (e.currentTarget.closest(".admin-chart") as HTMLElement).getBoundingClientRect();
              setTip({
                text: tipText(point.label, point.value, valueFormat, unitLabel),
                x: rect.left - parent.left + rect.width / 2,
                y: rect.top - parent.top,
              });
            }}
          >
            <div
              className={`admin-bar${point.value === 0 ? " is-empty" : ""}`}
              style={{ height: `${Math.max(point.value === 0 ? 2 : 4, (point.value / max) * 100)}%` }}
            />
            {index % showEvery === 0 ? (
              <span className="admin-bar-label">{point.label}</span>
            ) : (
              <span className="admin-bar-label" />
            )}
          </div>
        ))}
      </div>
      {tip ? (
        <div className="admin-tip" style={{ left: tip.x, top: tip.y }} role="tooltip">
          {tip.text}
        </div>
      ) : null}
    </div>
  );
}

export function AdminDonut({
  segments,
}: {
  segments: { label: string; value: number; tone: "t1" | "t2" | "t3" | "muted" }[];
}) {
  const totalValue = segments.reduce((n, s) => n + s.value, 0);
  const total = totalValue || 1;
  let offset = 0;
  const colors: Record<string, string> = {
    t1: "var(--text-3)",
    t2: "var(--accent)",
    t3: "var(--success)",
    muted: "var(--border)",
  };
  const [tip, setTip] = useState<string | null>(null);
  const uid = useId();

  return (
    <div className="admin-donut-wrap" onMouseLeave={() => setTip(null)}>
      <div className="admin-donut-stage">
        <svg viewBox="0 0 42 42" className="admin-donut" aria-hidden>
          <circle cx="21" cy="21" r="15.5" fill="transparent" stroke="var(--border)" strokeWidth="5" />
          {segments.map((seg) => {
            const len = (seg.value / total) * 97.4;
            const start = offset;
            offset += len;
            if (seg.value <= 0) return null;
            return (
              <circle
                key={seg.label}
                cx="21"
                cy="21"
                r="15.5"
                fill="transparent"
                stroke={colors[seg.tone]}
                strokeWidth="5"
                strokeDasharray={`${len} ${97.4 - len}`}
                strokeDashoffset={-start}
                strokeLinecap="butt"
                className="admin-donut-seg"
                onMouseEnter={() =>
                  setTip(`${seg.label}: ${seg.value} (${Math.round((seg.value / total) * 100)}%)`)
                }
              />
            );
          })}
          <text x="21" y="22.5" textAnchor="middle" className="admin-donut-total">
            {totalValue}
          </text>
        </svg>
        {tip ? (
          <div className="admin-tip admin-tip-center" id={uid} role="tooltip">
            {tip}
          </div>
        ) : null}
      </div>
      <ul className="admin-donut-legend">
        {segments.map((seg) => (
          <li
            key={seg.label}
            onMouseEnter={() =>
              setTip(
                totalValue
                  ? `${seg.label}: ${seg.value} (${Math.round((seg.value / total) * 100)}%)`
                  : `${seg.label}: 0`,
              )
            }
          >
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
  valueLabel = "ta",
}: {
  rows: { label: string; sub?: string; value: number }[];
  valueLabel?: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  if (rows.length === 0) return <p className="small muted">Hali ma&apos;lumot yo&apos;q.</p>;
  return (
    <div className="admin-hbar-list" onMouseLeave={() => setTip(null)}>
      {rows.map((row) => (
        <div
          key={row.label}
          className="admin-hbar-row"
          onMouseEnter={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const parent = (e.currentTarget.closest(".admin-hbar-list") as HTMLElement).getBoundingClientRect();
            setTip({
              text: `${row.label}${row.sub ? ` · ${row.sub}` : ""}: ${row.value} ${valueLabel}`,
              x: 12,
              y: rect.top - parent.top,
            });
          }}
        >
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
      {tip ? (
        <div className="admin-tip" style={{ left: Math.max(tip.x, 40), top: tip.y }} role="tooltip">
          {tip.text}
        </div>
      ) : null}
    </div>
  );
}
