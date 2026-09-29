"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FilterChips } from "@/components/cabinet/FilterChips";
import { SubmitForm } from "@/components/assignment/SubmitForm";
import { Icon } from "@/components/ui/Icon";
import { initials } from "@/lib/utils";

export type AssignmentState = "open" | "late" | "done";

type AssignmentItem = {
  id: string;
  titleUz: string;
  descriptionUz: string;
  dueLabel: string;
  courseTitle: string;
  teacherName: string;
  state: AssignmentState;
  grade: number | null;
  teacherNote: string | null;
};

type Filter = "all" | AssignmentState;

const ORDER: Record<AssignmentState, number> = { open: 0, late: 1, done: 2 };
const STATE_LABEL: Record<AssignmentState, string> = {
  open: "Ochiq",
  late: "Kechikkan",
  done: "Topshirilgan",
};

function AssignmentCard({ item }: { item: AssignmentItem }) {
  const [answering, setAnswering] = useState(false);
  return (
    <article className={`lx-as-card is-${item.state}`} data-testid="assignment-card">
      <div className="lx-as-top">
        <span className={`lx-as-state is-${item.state}`}>{STATE_LABEL[item.state]}</span>
        <span className="lx-as-due">
          <Icon name="clock" size={14} /> {item.dueLabel}
        </span>
      </div>
      <h3 className="lx-as-title">{item.titleUz}</h3>
      <p className="lx-sc-teacher">
        <span className="avatar sm" aria-hidden>
          {initials(item.teacherName)}
        </span>
        {item.courseTitle} · {item.teacherName}
      </p>
      {item.descriptionUz ? <p className="lx-as-desc">{item.descriptionUz}</p> : null}

      {item.state === "done" ? (
        <div className="lx-as-result">
          {item.grade != null ? (
            <p className="lx-as-grade">
              Baho: <strong>{item.grade}</strong>
            </p>
          ) : (
            <p className="lx-as-grade is-pending">Javobingiz yuborildi — tekshiruv kutilmoqda</p>
          )}
          {item.teacherNote ? <p className="lx-as-note">{item.teacherNote}</p> : null}
        </div>
      ) : answering ? (
        <div className="lx-as-form">
          <SubmitForm assignmentId={item.id} onCancel={() => setAnswering(false)} />
        </div>
      ) : (
        <div className="lx-as-actions">
          <button type="button" className="btn btn-primary" onClick={() => setAnswering(true)}>
            Javob yuborish
          </button>
        </div>
      )}
    </article>
  );
}

export function AssignmentsBoard({
  items,
  priorityNote,
}: {
  items: AssignmentItem[];
  priorityNote?: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const base = { all: items.length, open: 0, late: 0, done: 0 };
    for (const item of items) base[item.state] += 1;
    return base;
  }, [items]);

  const shown = useMemo(
    () =>
      items
        .filter((item) => filter === "all" || item.state === filter)
        .sort((a, b) => ORDER[a.state] - ORDER[b.state]),
    [items, filter],
  );

  const summary = [
    counts.open ? `${counts.open} ta ochiq` : null,
    counts.late ? `${counts.late} ta kechikkan` : null,
    counts.done ? `${counts.done} ta topshirilgan` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="lx-sc">
      <header className="lx-mc-head">
        <div>
          <p className="lx-kicker">Topshiriqlar</p>
          <h1 className="lx-mc-title">Topshiriqlar</h1>
          {summary ? <p className="lx-mc-sub">{summary}</p> : null}
          {priorityNote ? (
            <p className="lx-mc-sub">3-tarifdagi ishingiz o&apos;qituvchida birinchi navbatda.</p>
          ) : null}
        </div>
      </header>

      {items.length === 0 ? (
        <div className="lx-mc-empty">
          <h2>Topshiriq yo‘q</h2>
          <p>O‘qituvchi kursingizga topshiriq qo‘ysa, shu yerda chiqadi.</p>
          <Link href="/my-courses" className="btn btn-primary">
            Kurslarim
          </Link>
        </div>
      ) : (
        <>
          <div className="lx-mc-filters">
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
          </div>
          {shown.length === 0 ? (
            <div className="lx-mc-empty">
              <h2>Shu filtrda topshiriq yo‘q</h2>
              <p>Boshqa holatni tanlang.</p>
              <button type="button" className="btn btn-primary" onClick={() => setFilter("all")}>
                Hammasi
              </button>
            </div>
          ) : (
            <div className="lx-as-list">
              {shown.map((item) => (
                <AssignmentCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
