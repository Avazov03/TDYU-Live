"use client";

import { useId, useRef } from "react";
import { formatSom } from "@/lib/tariffs";
import { FloatingTip, useChartPointer } from "@/components/admin/FloatingTip";

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
  const rootRef = useRef<HTMLDivElement>(null);
  const { tip, reduced, atEvent, onMove, clear } = useChartPointer(rootRef);
  const max = Math.max(...data.map((d) => d.value), 1);
  const showEvery = data.length > 14 ? 5 : data.length > 8 ? 2 : 1;

  return (
    <div className="admin-chart" ref={rootRef} onMouseMove={onMove} onMouseLeave={clear}>
      <div className="admin-bars" style={{ height }}>
        {data.map((point, index) => (
          <div
            key={`${point.label}-${index}`}
            className="admin-bar-col"
            onMouseEnter={(e) => atEvent(e, tipText(point.label, point.value, valueFormat, unitLabel))}
            onMouseMove={(e) => atEvent(e, tipText(point.label, point.value, valueFormat, unitLabel))}
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
      <FloatingTip tip={tip} reduced={reduced} />
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
  const rootRef = useRef<HTMLDivElement>(null);
  const { tip, reduced, atEvent, onMove, clear } = useChartPointer(rootRef);
  const uid = useId();

  return (
    <div className="admin-donut-wrap" ref={rootRef} onMouseMove={onMove} onMouseLeave={clear}>
      <div className="admin-donut-stage">
        <svg viewBox="0 0 42 42" className="admin-donut" aria-hidden>
          <circle cx="21" cy="21" r="15.5" fill="transparent" stroke="var(--border)" strokeWidth="5" />
          {segments.map((seg) => {
            const len = (seg.value / total) * 97.4;
            const start = offset;
            offset += len;
            if (seg.value <= 0) return null;
            const text = `${seg.label}: ${seg.value} (${Math.round((seg.value / total) * 100)}%)`;
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
                onMouseEnter={(e) => atEvent(e as unknown as React.MouseEvent, text)}
                onMouseMove={(e) => atEvent(e as unknown as React.MouseEvent, text)}
              />
            );
          })}
          <text x="21" y="22.5" textAnchor="middle" className="admin-donut-total">
            {totalValue}
          </text>
        </svg>
      </div>
      <ul className="admin-donut-legend" aria-describedby={uid}>
        {segments.map((seg) => {
          const text = totalValue
            ? `${seg.label}: ${seg.value} (${Math.round((seg.value / total) * 100)}%)`
            : `${seg.label}: 0`;
          return (
            <li
              key={seg.label}
              onMouseEnter={(e) => atEvent(e, text)}
              onMouseMove={(e) => atEvent(e, text)}
            >
              <span className={`admin-dot tone-${seg.tone}`} />
              <span>{seg.label}</span>
              <b>{seg.value}</b>
            </li>
          );
        })}
      </ul>
      <FloatingTip tip={tip} reduced={reduced} />
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
  const rootRef = useRef<HTMLDivElement>(null);
  const { tip, reduced, atEvent, onMove, clear } = useChartPointer(rootRef);
  const max = Math.max(...rows.map((r) => r.value), 1);
  if (rows.length === 0) return <p className="small muted">Hali ma&apos;lumot yo&apos;q.</p>;
  return (
    <div className="admin-hbar-list" ref={rootRef} onMouseMove={onMove} onMouseLeave={clear}>
      {rows.map((row) => {
        const text = `${row.label}${row.sub ? ` · ${row.sub}` : ""}: ${row.value} ${valueLabel}`;
        return (
          <div
            key={row.label}
            className="admin-hbar-row"
            onMouseEnter={(e) => atEvent(e, text)}
            onMouseMove={(e) => atEvent(e, text)}
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
        );
      })}
      <FloatingTip tip={tip} reduced={reduced} />
    </div>
  );
}
