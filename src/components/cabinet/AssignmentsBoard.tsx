"use client";

import { useMemo, useState } from "react";
import { FilterChips } from "@/components/cabinet/FilterChips";
import { EmptyGuide } from "@/components/cabinet/EmptyGuide";
import { SubmitForm } from "@/components/assignment/SubmitForm";
import { formatDateTime } from "@/lib/utils";

type AssignmentItem = {
  id: string;
  titleUz: string;
  descriptionUz: string;
  dueAt: string;
  courseId: string;
  courseTitle: string;
  teacherId: string;
  teacherName: string;
  submitted: boolean;
  grade: number | null;
  teacherNote: string | null;
};

type DueFilter = "all" | "open" | "late" | "done";

function stateOf(item: AssignmentItem, now: number): Exclude<DueFilter, "all"> {
  if (item.submitted) return "done";
  if (new Date(item.dueAt).getTime() < now) return "late";
  return "open";
}

export function AssignmentsBoard({
  items,
  priorityNote,
}: {
  items: AssignmentItem[];
  priorityNote?: boolean;
}) {
  const [filter, setFilter] = useState<DueFilter>("all");
  const now = Date.now();

  const counts = useMemo(() => {
    const base = { all: items.length, open: 0, late: 0, done: 0 };
    for (const item of items) base[stateOf(item, now)] += 1;
    return base;
  }, [items, now]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((item) => stateOf(item, now) === filter);
  }, [items, filter, now]);

  const byTeacher = useMemo(() => {
    const map = new Map<
      string,
      { name: string; courses: Map<string, { id: string; title: string; items: AssignmentItem[] }> }
    >();
    for (const item of filtered) {
      const teacher = map.get(item.teacherId) ?? { name: item.teacherName, courses: new Map() };
      const course = teacher.courses.get(item.courseId) ?? {
        id: item.courseId,
        title: item.courseTitle,
        items: [],
      };
      course.items.push(item);
      teacher.courses.set(item.courseId, course);
      map.set(item.teacherId, teacher);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="lx-board">
      <p className="lx-kicker">Topshiriqlar</p>
      <h2>Kimdan va qaysi kursdan</h2>
      <p className="muted small lx-lead">Muddat va holat bo&apos;yicha filtr.</p>
      {priorityNote ? (
        <p className="small muted" style={{ marginTop: -8 }}>
          3-tarifdagi ishingiz o&apos;qituvchida birinchi navbatda.
        </p>
      ) : null}

      <FilterChips
        value={filter}
        onChange={setFilter}
        ariaLabel="Topshiriq holati"
        options={[
          { value: "all", label: "Hammasi", count: counts.all },
          { value: "open", label: "Ochiq", count: counts.open },
          { value: "late", label: "Kechikkan", count: counts.late },
          { value: "done", label: "Topshirilgan", count: counts.done },
        ]}
      />

      {items.length === 0 ? (
        <EmptyGuide
          title="Topshiriq yo‘q"
          text="Faol kurslaringizda hozircha vazifa qo‘yilmagan."
          href="/my-courses"
          cta="Kurslarim"
        />
      ) : null}

      {items.length > 0 && byTeacher.length === 0 ? (
        <div className="lx-empty">
          <h3>Shu filtrda topshiriq yo‘q</h3>
          <p className="muted small">Boshqa holatni tanlang.</p>
          <button type="button" className="btn btn-primary" onClick={() => setFilter("all")}>
            Hammasi
          </button>
        </div>
      ) : null}

      {byTeacher.map(([id, teacher]) => (
        <section key={id} className="lx-group">
          <h3>{teacher.name}</h3>
          {[...teacher.courses.values()].map((course) => (
            <div key={course.id} style={{ marginBottom: 16 }}>
              <p className="lx-kicker">{course.title}</p>
              <div className="lx-stack">
                {course.items.map((item) => {
                  const state = stateOf(item, now);
                  return (
                    <article key={item.id} className="lx-row">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3>{item.titleUz}</h3>
                        <p className="small muted" style={{ margin: 0 }}>
                          Muddat: {formatDateTime(new Date(item.dueAt))}
                        </p>
                        <p style={{ margin: "10px 0" }}>{item.descriptionUz}</p>
                        {state === "done" ? (
                          <div>
                            <span className="badge success">
                              {item.grade != null ? `Baho: ${item.grade}` : "Topshirilgan"}
                            </span>
                            {item.grade == null ? (
                              <p className="small muted">Tekshiruv kutilmoqda</p>
                            ) : null}
                            {item.teacherNote ? <p className="small">{item.teacherNote}</p> : null}
                          </div>
                        ) : (
                          <div>
                            <span className={`badge ${state === "late" ? "danger" : "pending"}`}>
                              {state === "late" ? "Kechikkan" : "Ochiq"}
                            </span>
                            <div style={{ marginTop: 10 }}>
                              <SubmitForm assignmentId={item.id} />
                            </div>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
