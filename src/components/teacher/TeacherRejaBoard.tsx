"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FilterChips } from "@/components/cabinet/FilterChips";
import { LessonActions } from "@/components/teacher/LessonActions";
import {
  clockLabel,
  hasPlayableRecording,
  shortDayTitle,
  statusLabel,
  statusTone,
  weekdayUz,
  type PlanStatus,
} from "@/lib/plan";
import { UZ_MONTHS_SHORT, tashkentParts } from "@/lib/utils";

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
  /** Set when the course is not published yet — no live room can be opened. */
  courseGate?: { label: string; canSubmit: boolean } | null;
  /** Course is under review/approved — plan frozen (server enforces the same). */
  planLocked?: boolean;
};

type Tab = "upcoming" | "past" | "all";

const UPCOMING: PlanStatus[] = ["scheduled", "lobby", "waiting_room", "live", "paused"];
const OPEN: PlanStatus[] = ["lobby", "waiting_room", "live", "paused"];

function relativeDay(date: Date) {
  const short = shortDayTitle(date);
  return /^(Bugun|Ertaga|Kecha)$/.test(short) ? short : weekdayUz(date);
}

export function TeacherRejaBoard({ lessons }: { lessons: RejaLessonRow[] }) {
  const upcoming = useMemo(
    () =>
      lessons
        .filter((l) => UPCOMING.includes(l.status))
        .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt)),
    [lessons],
  );
  const past = useMemo(
    () =>
      lessons
        .filter((l) => !UPCOMING.includes(l.status))
        .sort((a, b) => Date.parse(b.scheduledAt) - Date.parse(a.scheduledAt)),
    [lessons],
  );
  const [tab, setTab] = useState<Tab>(upcoming.length > 0 || past.length === 0 ? "upcoming" : "past");
  const rows = tab === "upcoming" ? upcoming : tab === "past" ? past : [...upcoming, ...past];

  return (
    <div className="lx-reja">
      <div className="lx-mc-filters">
        <FilterChips
          value={tab}
          onChange={setTab}
          ariaLabel="Darslar"
          options={[
            { value: "upcoming", label: "Kelgusi", count: upcoming.length },
            { value: "past", label: "O‘tgan", count: past.length },
            { value: "all", label: "Hammasi", count: lessons.length },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <div className="lx-mc-empty">
          <h2>{tab === "upcoming" ? "Kelgusi dars yo‘q" : "O‘tgan dars yo‘q"}</h2>
          <p>{tab === "upcoming" ? "Yuqoridan kursga yangi dars qo‘shing." : "Dars o‘tgach shu yerda chiqadi."}</p>
        </div>
      ) : (
        <div className="lx-reja-wrap">
          <table className="lx-reja-table">
            <thead>
              <tr>
                <th>Sana</th>
                <th>Dars</th>
                <th>Holat</th>
                <th>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((lesson) => {
                const when = new Date(lesson.scheduledAt);
                const p = tashkentParts(when);
                const ready = hasPlayableRecording(lesson.recordingUrl, lesson.playbackId);
                const open = OPEN.includes(lesson.status);
                return (
                  <tr key={lesson.id} className={open ? "is-live" : undefined}>
                    <td className="lx-reja-when">
                      <span className="lx-cd-date">
                        <strong>{Number(p.day)}</strong>
                        <span>{UZ_MONTHS_SHORT[p.monthIndex]}</span>
                      </span>
                      <span className="lx-reja-when-text">
                        <strong>{clockLabel(when)}</strong>
                        <span>{relativeDay(when)}</span>
                      </span>
                    </td>
                    <td className="lx-reja-lesson">
                      <Link href={`/learn/${lesson.id}`} className="lx-reja-title">
                        {lesson.titleUz}
                      </Link>
                      <span className="lx-reja-course">
                        {lesson.courseTitle}
                        {lesson.courseGate ? (
                          <span className="lx-cd-pill is-warn lx-reja-gate">Kurs: {lesson.courseGate.label}</span>
                        ) : null}
                      </span>
                      {lesson.summaryUz ? <span className="lx-reja-summary">{lesson.summaryUz}</span> : null}
                    </td>
                    <td className="lx-reja-status">
                      <span className={`badge ${statusTone(lesson.status, { hasRecording: ready })}`}>
                        {statusLabel(lesson.status, { hasRecording: ready })}
                      </span>
                    </td>
                    <td className="lx-reja-actions">
                      <LessonActions
                        lessonId={lesson.id}
                        status={lesson.status}
                        streamKey={lesson.streamKey}
                        titleUz={lesson.titleUz}
                        summaryUz={lesson.summaryUz}
                        coverUrl={lesson.coverUrl}
                        scheduledAt={lesson.scheduledAt}
                        courseGate={lesson.courseGate}
                        planLocked={lesson.planLocked}
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
