"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FilterChips } from "@/components/cabinet/FilterChips";
import { initials } from "@/lib/utils";

export type MyCourseItem = {
  id: string;
  courseId: string;
  title: string;
  subject: string;
  teacherId: string;
  teacherName: string;
  active: boolean;
  live: boolean;
  badge: string;
  done: number;
  total: number;
  nextText: string;
};

export type MyNextLesson = {
  lessonId: string;
  lessonTitle: string;
  courseTitle: string;
  when: string;
  live: boolean;
};

type ActiveFilter = "all" | "active" | "expired";

function thumbTone(id: string) {
  const n = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return `tone-${(n % 6) + 1}`;
}

export function MyCoursesBoard({
  items,
  nextLesson,
  hideTariffUi = false,
}: {
  items: MyCourseItem[];
  nextLesson: MyNextLesson | null;
  hideTariffUi?: boolean;
}) {
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [teacherId, setTeacherId] = useState("all");

  const teachers = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) map.set(item.teacherId, item.teacherName);
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [items]);

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        if (teacherId !== "all" && item.teacherId !== teacherId) return false;
        if (activeFilter === "active") return item.active;
        if (activeFilter === "expired") return !item.active;
        return true;
      }),
    [items, teacherId, activeFilter],
  );

  const counts = {
    all: items.length,
    active: items.filter((i) => i.active).length,
    expired: items.filter((i) => !i.active).length,
  };
  const browseHref = hideTariffUi ? "/#kurslar" : "/#tariflar";

  return (
    <div className="lx-mc">
      <header className="lx-mc-head">
        <div>
          <p className="lx-kicker">Kurslarim</p>
          <h1 className="lx-mc-title">Mening kurslarim</h1>
          {items.length > 0 ? (
            <p className="lx-mc-sub">
              {counts.all} ta kurs · {counts.active} ta faol
            </p>
          ) : null}
        </div>
        {items.length > 0 ? (
          <Link href={browseHref} className="btn">
            Yangi kurs topish
          </Link>
        ) : null}
      </header>

      {nextLesson ? (
        <section className={`lx-mc-next${nextLesson.live ? " is-live" : ""}`} aria-label="Keyingi dars">
          <div className="lx-mc-next-info">
            <span className="lx-mc-next-label">
              {nextLesson.live ? "Hozir efirda" : "Keyingi dars"}
            </span>
            <p className="lx-mc-next-title">{nextLesson.lessonTitle}</p>
            <p className="lx-mc-next-meta">
              {nextLesson.courseTitle} · <strong>{nextLesson.when}</strong>
            </p>
          </div>
          <Link href={`/learn/${nextLesson.lessonId}`} className="btn btn-primary lx-mc-next-cta">
            {nextLesson.live ? "Darsga kirish" : "Darsni ochish"}
          </Link>
        </section>
      ) : null}

      {items.length === 0 ? (
        <div className="lx-mc-empty">
          <h2>Hali kurs yo‘q</h2>
          <p>
            {hideTariffUi
              ? "Kurs sotib oling — u shu yerda darhol paydo bo‘ladi."
              : "Tarif to‘lab, onboardingda o‘qituvchi va kursni tanlang."}
          </p>
          <Link href={browseHref} className="btn btn-primary">
            {hideTariffUi ? "Kurslarni ko‘rish" : "Tarif tanlash"}
          </Link>
        </div>
      ) : (
        <>
          <div className="lx-mc-filters">
            <FilterChips
              value={activeFilter}
              onChange={setActiveFilter}
              ariaLabel="Kurs holati"
              options={[
                { value: "all", label: "Hammasi", count: counts.all },
                { value: "active", label: "Faol", count: counts.active },
                { value: "expired", label: "Yakunlangan", count: counts.expired },
              ]}
            />
            {teachers.length > 1 ? (
              <select
                className="staff-filter"
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                aria-label="O‘qituvchi"
              >
                <option value="all">Barcha o‘qituvchilar</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          {filtered.length === 0 ? (
            <div className="lx-mc-empty">
              <h2>Shu filtrda kurs yo‘q</h2>
              <p>Boshqa holat yoki o‘qituvchini tanlang.</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setActiveFilter("all");
                  setTeacherId("all");
                }}
              >
                Filtrni tozalash
              </button>
            </div>
          ) : (
            <div className="lx-course-grid">
              {filtered.map((item) => {
                const pct = item.total > 0 ? Math.round((item.done / item.total) * 100) : 0;
                return (
                  <Link
                    key={item.id}
                    href={`/courses/${item.courseId}`}
                    className="lx-ccard"
                    data-testid={item.active ? "my-course-active" : "my-course-completed"}
                  >
                    <div className={`lx-ccard-thumb course-thumb ${thumbTone(item.courseId)}`}>
                      <span className={`lx-ccard-status${item.live ? " is-live" : ""}`}>
                        {item.live ? "Jonli" : item.badge}
                      </span>
                    </div>
                    <div className="lx-ccard-body">
                      <p className="lx-ccard-subject">{item.subject}</p>
                      <h3 className="lx-ccard-title">{item.title}</h3>
                      <div className="lx-ccard-teacher">
                        <span className="avatar sm" aria-hidden>
                          {initials(item.teacherName)}
                        </span>
                        <span>{item.teacherName}</span>
                      </div>
                      {item.total > 0 ? (
                        <div className="lx-mc-progress">
                          <div className="lx-mc-progress-row">
                            <span>
                              {item.done} / {item.total} dars o‘tildi
                            </span>
                            <span>{pct}%</span>
                          </div>
                          <div className="lx-mc-bar" aria-hidden>
                            <span style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      ) : null}
                      <p className="lx-ccard-when">{item.nextText}</p>
                    </div>
                    <div className="lx-ccard-foot">
                      <span />
                      <span className="lx-ccard-go">
                        {item.active ? "Davom etish" : "Yozuvlarni ko‘rish"} <span aria-hidden>→</span>
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
