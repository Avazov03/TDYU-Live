import type { ReactNode } from "react";
import Link from "next/link";
import { hasPlayableRecording, statusLabel, statusTone } from "@/lib/plan";

type LessonRowProps = {
  id: string;
  titleUz: string;
  subtitle: string;
  status: "scheduled" | "live" | "ended";
  compact?: boolean;
  active?: boolean;
  actions?: ReactNode;
  recordingUrl?: string | null;
  playbackId?: string | null;
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
  recordingUrl,
  playbackId,
}: LessonRowProps) {
  const ready = hasPlayableRecording(recordingUrl, playbackId);
  const label = statusLabel(status, { hasRecording: ready });
  const tone = statusTone(status, { hasRecording: ready });
  const showPlay = status === "live" || (status === "ended" && ready);

  const body = (
    <>
      <div className={`rec-thumb course-thumb ${thumbTone(id)}`}>
        {status === "live" ? (
          <span className="dur live-dur">JONLI</span>
        ) : showPlay ? (
          <span className="thumb-play sm" aria-hidden>
            ▶
          </span>
        ) : (
          <span className="dur" aria-hidden>
            …
          </span>
        )}
      </div>
      <div className="vinfo" style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ fontSize: compact ? 13 : 14 }}>{titleUz}</h3>
        <p>{subtitle}</p>
        <span className={`badge ${tone}`}>{label}</span>
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
