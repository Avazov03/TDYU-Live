"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FilterChips } from "@/components/cabinet/FilterChips";
import { LessonActions } from "@/components/teacher/LessonActions";
import { clockLabel, dayTitle, hasPlayableRecording, statusLabel, statusTone, type PlanStatus } from "@/lib/plan";
import { formatDateTime } from "@/lib/utils";

export type RejaLessonRow = {
  id: string;
  titleUz: string;
  summaryUz?: string | null;
  coverUrl?: string | null;
  scheduledAt: string;
  status: PlanStatus;
  courseTitle: string;
  recordingUrl?: string | null;
  playbackId?: string | null;
  streamKey?: string | null;
};

type Filter = "all" | "scheduled" | "lobby" | "live" | "ended";

export function TeacherRejaBoard({ lessons }: { lessons: RejaLessonRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const base = { all: lessons.length, scheduled: 0, lobby: 0, live: 0, ended: 0 };
    for (const l of lessons) {
      if (l.status === "scheduled") base.scheduled += 1;
      else if (l.status === "lobby") base.lobby += 1;
      else if (l.status === "live") base.live += 1;
      else base.ended += 1;
    }
    return base;
  }, [lessons]);

  const rows = useMemo(() => {
    const list = filter === "all" ? lessons : lessons.filter((l) => l.status === filter);
    return [...list].sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );
  }, [lessons, filter]);

  return (
    <div className="lx-board">
      <FilterChips
        value={filter}
        onChange={setFilter}
        ariaLabel="Dars holati"
        options={[
          { value: "all", label: "Hammasi", count: counts.all },
          { value: "scheduled", label: "Reja", count: counts.scheduled },
          { value: "lobby", label: "Kutish", count: counts.lobby },
          { value: "live", label: "Jonli", count: counts.live },
          { value: "ended", label: "Yozuv", count: counts.ended },
        ]}
      />

      {rows.length === 0 ? (
        <p className="muted small">Shu filtrda dars yo‘q.</p>
      ) : (
        <div className="reja-table-wrap">
          <table className="reja-table">
            <thead>
              <tr>
                <th>Sana</th>
                <th>Vaqt</th>
                <th>Kurs</th>
                <th>Mavzu</th>
                <th>Holat</th>
                <th>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((lesson) => {
                const when = new Date(lesson.scheduledAt);
                const ready = hasPlayableRecording(lesson.recordingUrl, lesson.playbackId);
                return (
                  <tr key={lesson.id}>
                    <td>
                      <div className="reja-date">{dayTitle(when)}</div>
                      <div className="small muted">{formatDateTime(when).split(" ")[0]}</div>
                    </td>
                    <td>{clockLabel(when)}</td>
                    <td>{lesson.courseTitle}</td>
                    <td>
                      <Link href={`/learn/${lesson.id}`} className="reja-title-link">
                        {lesson.titleUz}
                      </Link>
                      {lesson.summaryUz ? (
                        <div className="small muted reja-summary">{lesson.summaryUz}</div>
                      ) : null}
                    </td>
                    <td>
                      <span className={`badge ${statusTone(lesson.status, { hasRecording: ready })}`}>
                        {statusLabel(lesson.status, { hasRecording: ready })}
                      </span>
                    </td>
                    <td>
                      <LessonActions
                        lessonId={lesson.id}
                        status={lesson.status}
                        streamKey={lesson.streamKey}
                        titleUz={lesson.titleUz}
                        summaryUz={lesson.summaryUz}
                        coverUrl={lesson.coverUrl}
                        scheduledAt={lesson.scheduledAt}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
