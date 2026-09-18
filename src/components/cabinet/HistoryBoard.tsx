"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FilterChips } from "@/components/cabinet/FilterChips";
import { EmptyGuide } from "@/components/cabinet/EmptyGuide";
import { dayTitle, localDayKey } from "@/lib/plan";
import { formatDateTime } from "@/lib/utils";

type HistoryItem = {
  id: string;
  lessonId: string;
  title: string;
  courseId: string;
  courseTitle: string;
  teacher: string;
  joinedAt: string;
};

export function HistoryBoard({ items }: { items: HistoryItem[] }) {
  const [courseId, setCourseId] = useState("all");

  const courses = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) map.set(item.courseId, item.courseTitle);
    return [...map.entries()].map(([id, title]) => ({ id, title }));
  }, [items]);

  const filtered = useMemo(() => {
    if (courseId === "all") return items;
    return items.filter((i) => i.courseId === courseId);
  }, [items, courseId]);

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
    <div className="lx-board">
      <p className="lx-kicker">Ko&apos;rilganlar</p>
      <h2>Ochgan darslaringiz</h2>
      <p className="muted small lx-lead">Kurs bo&apos;yicha filtrlang.</p>

      {courses.length > 1 ? (
        <div className="lx-filter-row">
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

      {items.length === 0 ? (
        <EmptyGuide
          title="Hali dars ochilmagan"
          text="Darsga kirganingizdan keyin shu yerda tarix saqlanadi."
          href="/schedule"
          cta="Dars rejaga"
        />
      ) : null}

      {items.length > 0 && byDay.length === 0 ? (
        <div className="lx-empty">
          <h3>Shu kursda yozuv yo‘q</h3>
          <p className="muted small">Boshqa kursni tanlang.</p>
          <button type="button" className="btn btn-primary" onClick={() => setCourseId("all")}>
            Hammasi
          </button>
        </div>
      ) : null}

      {byDay.map(([key, rows]) => (
        <section key={key} className="lx-group">
          <h3>{dayTitle(rows[0] ? new Date(rows[0].joinedAt) : new Date(key))}</h3>
          <div className="lx-stack">
            {rows.map((row) => (
              <Link key={row.id} href={`/learn/${row.lessonId}`} className="lx-row">
                <div>
                  <p className="lx-kicker">
                    {row.teacher} · {formatDateTime(new Date(row.joinedAt))}
                  </p>
                  <h3>{row.title}</h3>
                  <p className="small muted" style={{ margin: 0 }}>
                    {row.courseTitle}
                  </p>
                </div>
                <span className="lx-go">Ochish</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
