"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FilterChips } from "@/components/cabinet/FilterChips";
import { Timeline } from "@/components/ui/aceternity-timeline";
import {
  clockLabel,
  localDayKey,
  shortDayTitle,
  statusLabel,
  weekdayUz,
  type PlanStatus,
} from "@/lib/plan";
import { UZ_MONTHS_LONG, initials, tashkentParts } from "@/lib/utils";

export type ScheduleLesson = {
  id: string;
  title: string;
  when: string;
  endsAt: string;
  teacher: string;
  course: string;
  summary: string | null;
  status: PlanStatus;
  hasRecording: boolean;
  upcoming: boolean;
};

type Tab = "upcoming" | "past" | "all";

const OPEN_STATUSES: PlanStatus[] = ["live", "lobby", "waiting_room", "paused"];

function pillFor(lesson: ScheduleLesson): { text: string; live?: boolean } | null {
  if (lesson.status === "live") return { text: "Jonli", live: true };
  if (lesson.status === "lobby" || lesson.status === "waiting_room") return { text: "Kutish zali", live: true };
  if (lesson.status === "paused") return { text: "Pauza" };
  if (lesson.status === "cancelled") return { text: "Bekor qilingan" };
  if (lesson.status === "scheduled") return lesson.upcoming ? null : { text: "Boshlanmagan" };
  if (lesson.hasRecording) return { text: "Yozuv bor" };
  return { text: statusLabel(lesson.status, { hasRecording: false }) };
}

function LessonCard({ lesson }: { lesson: ScheduleLesson }) {
  const start = new Date(lesson.when);
  const end = new Date(lesson.endsAt);
  const open = OPEN_STATUSES.includes(lesson.status);
  const cancelled = lesson.status === "cancelled";
  const pill = pillFor(lesson);
  const href = `/learn/${lesson.id}`;

  return (
    <article
      className={`lx-sc-card${open ? " is-live" : ""}${cancelled ? " is-cancelled" : ""}`}
      data-testid="schedule-lesson"
    >
      <div className="lx-sc-time">
        <strong>{clockLabel(start)}</strong>
        <span>{clockLabel(end)}</span>
      </div>
      <div className="lx-sc-info">
        <p className="lx-sc-meta">
          {weekdayUz(start)}
          {pill ? <span className={`lx-cd-pill${pill.live ? " is-live" : ""}`}>{pill.text}</span> : null}
        </p>
        <h3 className="lx-sc-title">
          {cancelled ? lesson.title : <Link href={href}>{lesson.title}</Link>}
        </h3>
        <p className="lx-sc-course">{lesson.course}</p>
        <p className="lx-sc-teacher">
          <span className="avatar sm" aria-hidden>
            {initials(lesson.teacher)}
          </span>
          {lesson.teacher}
        </p>
        {lesson.summary ? <p className="lx-sc-summary">{lesson.summary}</p> : null}
      </div>
      {cancelled ? null : (
        <div className="lx-sc-action">
          {open ? (
            <Link href={href} className="btn btn-primary">
              Darsga kirish
            </Link>
          ) : lesson.hasRecording ? (
            <Link href={href} className="btn">
              Yozuvni ko‘rish
            </Link>
          ) : (
            <Link href={href} className="btn">
              Ochish
            </Link>
          )}
        </div>
      )}
    </article>
  );
}

export function ScheduleBoard({ lessons }: { lessons: ScheduleLesson[] }) {
  const upcoming = useMemo(() => lessons.filter((l) => l.upcoming), [lessons]);
  const past = useMemo(() => lessons.filter((l) => !l.upcoming).reverse(), [lessons]);
  const [tab, setTab] = useState<Tab>(upcoming.length > 0 || past.length === 0 ? "upcoming" : "past");

  const shown = tab === "upcoming" ? upcoming : tab === "past" ? past : lessons;
  const next = upcoming.find((l) => l.status !== "cancelled");

  const data = useMemo(() => {
    const byDay = new Map<string, ScheduleLesson[]>();
    for (const lesson of shown) {
      const key = localDayKey(new Date(lesson.when));
      const list = byDay.get(key) ?? [];
      list.push(lesson);
      byDay.set(key, list);
    }
    return [...byDay.entries()].map(([key, items]) => ({
      key,
      title: shortDayTitle(new Date(items[0].when)),
      content: (
        <div className="lx-sc-day">
          {items.map((lesson) => (
            <LessonCard key={lesson.id} lesson={lesson} />
          ))}
        </div>
      ),
    }));
  }, [shown]);

  const nextStart = next ? new Date(next.when) : null;
  const nextParts = nextStart ? tashkentParts(nextStart) : null;

  return (
    <div className="lx-sc">
      <header className="lx-mc-head">
        <div>
          <p className="lx-kicker">Dars reja</p>
          <h1 className="lx-mc-title">Dars jadvali</h1>
          {lessons.length > 0 ? (
            <p className="lx-mc-sub">
              {lessons.length} ta dars
              {nextStart && nextParts
                ? ` · keyingisi ${Number(nextParts.day)}-${UZ_MONTHS_LONG[nextParts.monthIndex]}, ${clockLabel(nextStart)}`
                : ""}
            </p>
          ) : null}
        </div>
      </header>

      {lessons.length === 0 ? (
        <div className="lx-mc-empty">
          <h2>Hali dars yo‘q</h2>
          <p>O‘qituvchi kursingizga dars qo‘shgach, jadval shu yerda chiqadi.</p>
          <Link href="/my-courses" className="btn btn-primary">
            Kurslarim
          </Link>
        </div>
      ) : (
        <>
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

          {data.length === 0 ? (
            <div className="lx-mc-empty">
              <h2>{tab === "upcoming" ? "Kelgusi dars yo‘q" : "O‘tgan dars yo‘q"}</h2>
              <p>
                {tab === "upcoming"
                  ? "O‘qituvchi yangi dars qo‘shsa, shu yerda chiqadi."
                  : "Birinchi darsdan keyin yozuvlar shu yerda to‘planadi."}
              </p>
              {tab === "upcoming" && past.length > 0 ? (
                <button type="button" className="btn btn-primary" onClick={() => setTab("past")}>
                  O‘tgan darslarni ko‘rish
                </button>
              ) : null}
            </div>
          ) : (
            <Timeline key={tab} data={data} />
          )}
        </>
      )}
    </div>
  );
}
