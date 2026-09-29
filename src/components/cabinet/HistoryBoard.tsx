"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FilterChips } from "@/components/cabinet/FilterChips";
import {
  clockLabel,
  localDayKey,
  shortDayTitle,
  statusLabel,
  weekdayUz,
  type PlanStatus,
} from "@/lib/plan";
import { initials } from "@/lib/utils";

type HistoryItem = {
  id: string;
  lessonId: string;
  title: string;
  courseId: string;
  courseTitle: string;
  teacher: string;
  joinedAt: string;
  status: PlanStatus;
  hasRecording: boolean;
};

const OPEN_STATUSES: PlanStatus[] = ["live", "lobby", "waiting_room", "paused"];

function pillFor(item: HistoryItem): { text: string; live?: boolean } | null {
  if (item.status === "live") return { text: "Jonli", live: true };
  if (OPEN_STATUSES.includes(item.status)) return { text: "Kutish zali", live: true };
  if (item.status === "cancelled") return { text: "Bekor qilingan" };
  if (item.status === "scheduled") return null;
  if (item.hasRecording) return { text: "Yozuv bor" };
  return { text: statusLabel(item.status, { hasRecording: false }) };
}

export function HistoryBoard({ items }: { items: HistoryItem[] }) {
  const [courseId, setCourseId] = useState("all");

  const courses = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) map.set(item.courseId, item.courseTitle);
    return [...map.entries()].map(([id, title]) => ({ id, title }));
  }, [items]);

  const filtered = useMemo(
    () => (courseId === "all" ? items : items.filter((i) => i.courseId === courseId)),
    [items, courseId],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, HistoryItem[]>();
    for (const item of filtered) {
      const key = localDayKey(new Date(item.joinedAt));
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="lx-sc">
      <header className="lx-mc-head">
        <div>
          <p className="lx-kicker">Ko&apos;rilganlar</p>
          <h1 className="lx-mc-title">Ko&apos;rilganlar</h1>
          {items.length > 0 ? (
            <p className="lx-mc-sub">{items.length} ta dars · oxirgi kirganlaringiz tepada</p>
          ) : null}
        </div>
      </header>

      {items.length === 0 ? (
        <div className="lx-mc-empty">
          <h2>Hali dars ochilmagan</h2>
          <p>Darsga kirganingizdan keyin u shu yerda saqlanadi — yozuvga qaytish oson bo‘ladi.</p>
          <Link href="/schedule" className="btn btn-primary">
            Dars jadvali
          </Link>
        </div>
      ) : (
        <>
          {courses.length > 1 ? (
            <div className="lx-mc-filters">
              <FilterChips
                value={courseId}
                onChange={setCourseId}
                ariaLabel="Kurs"
                options={[
                  { value: "all", label: "Barcha kurslar", count: items.length },
                  ...courses.map((c) => ({
                    value: c.id,
                    label: c.title,
                    count: items.filter((i) => i.courseId === c.id).length,
                  })),
                ]}
              />
            </div>
          ) : null}

          <div className="lx-hist">
            {byDay.map(([key, rows]) => (
              <section key={key} className="lx-hist-day">
                <h2 className="lx-hist-dayhead">
                  {shortDayTitle(new Date(rows[0].joinedAt))}
                  <span>{weekdayUz(new Date(rows[0].joinedAt))}</span>
                </h2>
                <div className="lx-sc-day">
                  {rows.map((row) => {
                    const pill = pillFor(row);
                    const open = OPEN_STATUSES.includes(row.status);
                    return (
                      <article key={row.id} className={`lx-sc-card${open ? " is-live" : ""}`}>
                        <div className="lx-sc-time">
                          <strong>{clockLabel(new Date(row.joinedAt))}</strong>
                          <span>kirgansiz</span>
                        </div>
                        <div className="lx-sc-info">
                          {pill ? (
                            <p className="lx-sc-meta">
                              <span className={`lx-cd-pill${pill.live ? " is-live" : ""}`}>{pill.text}</span>
                            </p>
                          ) : null}
                          <h3 className="lx-sc-title">
                            <Link href={`/learn/${row.lessonId}`}>{row.title}</Link>
                          </h3>
                          <p className="lx-sc-course">{row.courseTitle}</p>
                          <p className="lx-sc-teacher">
                            <span className="avatar sm" aria-hidden>
                              {initials(row.teacher)}
                            </span>
                            {row.teacher}
                          </p>
                        </div>
                        <div className="lx-sc-action">
                          <Link
                            href={`/learn/${row.lessonId}`}
                            className={`btn${open ? " btn-primary" : ""}`}
                          >
                            {open ? "Darsga qaytish" : row.hasRecording ? "Yozuvni ko‘rish" : "Ochish"}
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
