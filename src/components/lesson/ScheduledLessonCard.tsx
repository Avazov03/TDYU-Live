"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AddToCalendar } from "@/components/lesson/AddToCalendar";

const WATCH_BEFORE_MS = 15 * 60_000;
const REFRESH_MS = 20_000;
/** Teachers may open the room early (schedule rules allow it when nothing overlaps). */
const EARLY_REFRESH_MS = 60_000;

/** Enrolled student before the room opens — picks up the waiting room without a manual reload. */
export function ScheduledLessonCard({
  lessonId,
  title,
  courseTitle,
  startsAtIso,
  endsAtIso,
  dayNum,
  monthShort,
  whenLabel,
  relativeLabel,
  lessonUrl,
}: {
  lessonId: string;
  title: string;
  courseTitle: string;
  startsAtIso: string;
  endsAtIso: string;
  dayNum: string;
  monthShort: string;
  whenLabel: string;
  relativeLabel: string;
  lessonUrl: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const startsAt = new Date(startsAtIso).getTime();
    let timer = 0;
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
      const soon = startsAt - WATCH_BEFORE_MS <= Date.now();
      timer = window.setTimeout(tick, soon ? REFRESH_MS : EARLY_REFRESH_MS);
    };
    const soon = startsAt - WATCH_BEFORE_MS <= Date.now();
    timer = window.setTimeout(tick, soon ? REFRESH_MS : EARLY_REFRESH_MS);
    return () => window.clearTimeout(timer);
  }, [router, startsAtIso]);

  return (
    <div className="player-wrap">
      <div
        className={`player-demo course-thumb tone-${(lessonId.charCodeAt(0) % 6) + 1} lx-soon`}
        data-testid="lesson-scheduled"
      >
        <span className="lx-cd-pill is-accent">Rejada</span>
        <div className="lx-cd-date lx-soon-date" aria-hidden>
          <strong>{dayNum}</strong>
          <span>{monthShort}</span>
        </div>
        <h3 className="lx-soon-title">{title}</h3>
        <p className="lx-soon-when">
          {whenLabel} · <b>{relativeLabel}</b>
        </p>
        <p className="lx-soon-note">Dars boshlanganda shu sahifada o‘zi ochiladi.</p>
        <AddToCalendar
          className="btn btn-sm lx-soon-cal"
          lessonId={lessonId}
          title={title}
          courseTitle={courseTitle}
          startsAtIso={startsAtIso}
          endsAtIso={endsAtIso}
          lessonUrl={lessonUrl}
          fileName={`lexify-dars-${dayNum}-${monthShort}.ics`}
        />
      </div>
    </div>
  );
}
