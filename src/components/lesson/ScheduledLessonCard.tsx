"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const WATCH_BEFORE_MS = 15 * 60_000;
const REFRESH_MS = 20_000;
/** Teachers may open the room early (schedule rules allow it when nothing overlaps). */
const EARLY_REFRESH_MS = 60_000;

/** Enrolled student before the room opens — picks up the waiting room without a manual reload. */
export function ScheduledLessonCard({
  lessonId,
  title,
  startsAtIso,
  startsAtLabel,
}: {
  lessonId: string;
  title: string;
  startsAtIso: string;
  startsAtLabel: string;
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
      <div className={`player-demo course-thumb tone-${(lessonId.charCodeAt(0) % 6) + 1}`}>
        <div>
          <div className="badge pending" style={{ marginBottom: 8 }} data-testid="lesson-scheduled">
            REJADA
          </div>
          <h3>{title}</h3>
          <p className="muted small">
            Dars {startsAtLabel} da boshlanadi. O‘qituvchi kutish xonasini ochganda shu yerda o‘zi paydo bo‘ladi.
          </p>
        </div>
      </div>
    </div>
  );
}
