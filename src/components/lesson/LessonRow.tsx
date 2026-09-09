import type { ReactNode } from "react";
import Link from "next/link";

type LessonRowProps = {
  id: string;
  titleUz: string;
  subtitle: string;
  status: "scheduled" | "live" | "ended";
  compact?: boolean;
  active?: boolean;
  actions?: ReactNode;
};

const STATUS = {
  live: { label: "JONLI", className: "danger" },
  ended: { label: "Yozuv", className: "success" },
  scheduled: { label: "Reja", className: "pending" },
};

function thumbTone(id: string) {
  const n = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return `tone-${(n % 6) + 1}`;
}

export function LessonRow({
  id,
  titleUz,
  subtitle,
  status,
  compact,
  active,
  actions,
}: LessonRowProps) {
  const s = STATUS[status];
  const body = (
    <>
      <div className={`rec-thumb course-thumb ${thumbTone(id)}`}>
        {status === "live" ? (
          <span className="dur live-dur">JONLI</span>
        ) : (
          <span className="thumb-play sm" aria-hidden>
            ▶
          </span>
        )}
      </div>
      <div className="vinfo" style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ fontSize: compact ? 13 : 14 }}>{titleUz}</h3>
        <p>{subtitle}</p>
        <span className={`badge ${s.className}`}>{s.label}</span>
      </div>
    </>
  );

  if (actions) {
    return (
      <div className={`watch-rec-card row gap-12${active ? " active-lesson" : ""}`}>
        <Link href={`/learn/${id}`} className="row gap-12" style={{ flex: 1, minWidth: 0, color: "inherit", textDecoration: "none" }}>
          {body}
        </Link>
        <div className="lesson-actions">{actions}</div>
      </div>
    );
  }

  return (
    <Link
      href={`/learn/${id}`}
      className={`watch-rec-card row gap-12${active ? " active-lesson" : ""}`}
    >
      {body}
    </Link>
  );
}
