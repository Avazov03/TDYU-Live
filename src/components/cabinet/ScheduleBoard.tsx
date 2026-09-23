"use client";

import { useMemo, useState } from "react";
import { PlanCard } from "@/components/cabinet/PlanCard";
import { FilterChips } from "@/components/cabinet/FilterChips";
import { Timeline } from "@/components/ui/aceternity-timeline";
import { dayTitle, hasPlayableRecording, localDayKey } from "@/lib/plan";

export type ScheduleLesson = {
  id: string;
  title: string;
  when: string;
  teacher: string;
  course: string;
  summary?: string | null;
  coverUrl?: string | null;
  playbackId?: string | null;
  recordingUrl?: string | null;
  status: import("@/lib/plan").PlanStatus;
};

type StatusFilter = "all" | "live" | "lobby" | "scheduled" | "ready" | "waiting";

function matches(lesson: ScheduleLesson, filter: StatusFilter) {
  if (filter === "all") return true;
  if (filter === "live") return lesson.status === "live";
  if (filter === "lobby") return lesson.status === "lobby";
  if (filter === "scheduled") return lesson.status === "scheduled";
  const ready = hasPlayableRecording(lesson.recordingUrl, lesson.playbackId);
  if (filter === "ready") return lesson.status === "ended" && ready;
  return lesson.status === "ended" && !ready;
}

export function ScheduleBoard({ lessons }: { lessons: ScheduleLesson[] }) {
  const [filter, setFilter] = useState<StatusFilter>("all");

  const counts = useMemo(() => {
    const base = { all: lessons.length, live: 0, lobby: 0, scheduled: 0, ready: 0, waiting: 0 };
    for (const lesson of lessons) {
      if (lesson.status === "live") base.live += 1;
      else if (lesson.status === "lobby") base.lobby += 1;
      else if (lesson.status === "scheduled") base.scheduled += 1;
      else if (hasPlayableRecording(lesson.recordingUrl, lesson.playbackId)) base.ready += 1;
      else base.waiting += 1;
    }
    return base;
  }, [lessons]);

  const filtered = useMemo(() => lessons.filter((l) => matches(l, filter)), [lessons, filter]);

  const data = useMemo(() => {
    const byDay = new Map<string, ScheduleLesson[]>();
    for (const lesson of filtered) {
      const key = localDayKey(new Date(lesson.when));
      const list = byDay.get(key) ?? [];
      list.push(lesson);
      byDay.set(key, list);
    }
    return [...byDay.entries()].map(([key, items]) => ({
      key,
      title: dayTitle(items[0] ? new Date(items[0].when) : new Date(key)),
      content: (
        <div className="lx-stack">
          {items.map((lesson) => (
            <PlanCard
              key={lesson.id}
              id={lesson.id}
              title={lesson.title}
              when={lesson.when}
              teacher={lesson.teacher}
              course={lesson.course}
              summary={lesson.summary}
              coverUrl={lesson.coverUrl}
              playbackId={lesson.playbackId}
              recordingUrl={lesson.recordingUrl}
              status={lesson.status}
            />
          ))}
        </div>
      ),
    }));
  }, [filtered]);

  return (
    <div className="lx-board">
      <p className="lx-kicker">Dars reja</p>
      <h2>Vaqt, o&apos;qituvchi, kurs</h2>
      <p className="muted small lx-lead">Holat bo&apos;yicha filtrlang.</p>

      <FilterChips
        value={filter}
        onChange={setFilter}
        ariaLabel="Dars holati"
        options={[
          { value: "all", label: "Hammasi", count: counts.all },
          { value: "live", label: "Jonli", count: counts.live },
          { value: "lobby", label: "Kutish", count: counts.lobby },
          { value: "scheduled", label: "Reja", count: counts.scheduled },
          { value: "ready", label: "Ko‘rish", count: counts.ready },
          { value: "waiting", label: "Kutilmoqda", count: counts.waiting },
        ]}
      />

      {data.length === 0 ? (
        <div className="lx-empty">
          <h3>Shu filtrda dars yo‘q</h3>
          <p className="muted small">Boshqa holatni tanlang yoki Kurslarimni tekshiring.</p>
          <button type="button" className="btn btn-primary" onClick={() => setFilter("all")}>
            Hammasi
          </button>
        </div>
      ) : (
        <Timeline data={data} />
      )}
    </div>
  );
}
