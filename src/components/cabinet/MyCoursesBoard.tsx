"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FilterChips } from "@/components/cabinet/FilterChips";
import { EmptyGuide } from "@/components/cabinet/EmptyGuide";
import { TARIFF_LABELS } from "@/lib/tariffs";

type CourseItem = {
  id: string;
  courseId: string;
  title: string;
  subject: string;
  teacherId: string;
  teacherName: string;
  active: boolean;
  tier: keyof typeof TARIFF_LABELS;
  nextLabel: string;
};

type ActiveFilter = "all" | "active" | "expired";

export function MyCoursesBoard({
  items,
  hideTariffUi = false,
}: {
  items: CourseItem[];
  hideTariffUi?: boolean;
}) {
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [teacherId, setTeacherId] = useState("all");

  const teachers = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) map.set(item.teacherId, item.teacherName);
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (teacherId !== "all" && item.teacherId !== teacherId) return false;
      if (activeFilter === "active") return item.active;
      if (activeFilter === "expired") return !item.active;
      return true;
    });
  }, [items, teacherId, activeFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, { name: string; items: CourseItem[] }>();
    for (const item of filtered) {
      const group = map.get(item.teacherId) ?? { name: item.teacherName, items: [] };
      group.items.push(item);
      map.set(item.teacherId, group);
    }
    return [...map.entries()];
  }, [filtered]);

  const counts = {
    all: items.length,
    active: items.filter((i) => i.active).length,
    expired: items.filter((i) => !i.active).length,
  };

  return (
    <div className="lx-board">
      <p className="lx-kicker">Kurslarim</p>
      <h2>O&apos;qituvchi, keyin uning kurslari</h2>
      <p className="muted small lx-lead">O&apos;qituvchi va holat bo&apos;yicha filtr.</p>

      <div className="lx-filter-row">
        <FilterChips
          value={activeFilter}
          onChange={setActiveFilter}
          ariaLabel="Obuna holati"
          options={[
            { value: "all", label: "Hammasi", count: counts.all },
            { value: "active", label: "Faol", count: counts.active },
            { value: "expired", label: "Tugagan", count: counts.expired },
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

      {items.length === 0 ? (
        <EmptyGuide
          title="Hali kurs yo‘q"
          text={
            hideTariffUi
              ? "Kurs sotib oling — My Courses da Enrollment ko‘rinadi."
              : "Tarif to‘lab, onboardingda o‘qituvchi va kursni tanlang."
          }
          href={hideTariffUi ? "/search" : "/#tariflar"}
          cta={hideTariffUi ? "Kurslarni qidirish" : "Tarif tanlash"}
        />
      ) : null}

      {items.length > 0 && groups.length === 0 ? (
        <div className="lx-empty">
          <h3>Shu filtrda kurs yo‘q</h3>
          <p className="muted small">Boshqa holat yoki o‘qituvchini tanlang.</p>
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
      ) : null}

      {groups.map(([id, group]) => (
        <section key={id} className="lx-group">
          <h3>{group.name}</h3>
          <div className="lx-stack">
            {group.items.map((sub) => (
              <Link key={sub.id} href={`/courses/${sub.courseId}`} className={`lx-row${sub.active ? "" : " is-dim"}`}>
                <div>
                  <p className="lx-kicker">{sub.subject}</p>
                  <h3>{sub.title}</h3>
                  <p className="small muted" style={{ margin: "0 0 8px" }}>
                    {sub.nextLabel}
                  </p>
                  <span className={`badge ${sub.active ? "accent" : ""}`}>
                    {sub.active
                      ? hideTariffUi
                        ? "Enrollment"
                        : TARIFF_LABELS[sub.tier]
                      : "Muddati tugagan"}
                  </span>
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
