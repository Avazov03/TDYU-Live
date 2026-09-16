"use client";

import { useState } from "react";
import Link from "next/link";
import { lessonCover, clockLabel, statusLabel } from "@/lib/plan";
import { coverUrl as generatedCover } from "@/lib/thumbs";

export function PlanCard({
  id,
  title,
  when,
  teacher,
  course,
  summary,
  coverUrl,
  playbackId,
  status,
  actions,
}: {
  id: string;
  title: string;
  when: Date;
  teacher: string;
  course: string;
  summary?: string | null;
  coverUrl?: string | null;
  playbackId?: string | null;
  status: "live" | "scheduled" | "ended";
  actions?: React.ReactNode;
}) {
  const initial = lessonCover(coverUrl, playbackId, { id, title });
  const [src, setSrc] = useState(initial);
  const tone = status === "live" ? "danger" : status === "ended" ? "success" : "pending";

  return (
    <article className="lx-row">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="lx-cover"
          src={src}
          alt=""
          onError={() => setSrc(generatedCover(id, title, null))}
        />
      ) : null}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="lx-kicker">
          {clockLabel(when)} · {teacher}
        </p>
        <h3>
          <Link href={`/learn/${id}`}>{title}</Link>
        </h3>
        <p className="small muted" style={{ margin: 0 }}>
          {course}
        </p>
        {summary ? <p style={{ margin: "8px 0 0" }}>{summary}</p> : null}
        <div className="row gap-8" style={{ marginTop: 10 }}>
          <span className={`badge ${tone}`}>{statusLabel(status)}</span>
          {actions}
        </div>
      </div>
    </article>
  );
}
