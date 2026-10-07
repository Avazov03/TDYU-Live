"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FilterChips } from "@/components/cabinet/FilterChips";
import { LessonActions } from "@/components/teacher/LessonActions";
import { confirmAction } from "@/components/ui/ConfirmDialog";
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
  endsAt: string;
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

type Tab = "upcoming" | "overdue" | "past" | "all";

const UPCOMING: PlanStatus[] = ["scheduled", "lobby", "waiting_room", "live", "paused"];
const OPEN: PlanStatus[] = ["lobby", "waiting_room", "live", "paused"];

function relativeDay(date: Date) {
  const short = shortDayTitle(date);
  return /^(Bugun|Ertaga|Kecha)$/.test(short) ? short : weekdayUz(date);
}

export function TeacherRejaBoard({ lessons, nowIso }: { lessons: RejaLessonRow[]; nowIso: string }) {
  const router = useRouter();
  const overdueIds = useMemo(() => {
    const nowMs = Date.parse(nowIso);
    return new Set(lessons.filter((l) => l.status === "scheduled" && Date.parse(l.endsAt) <= nowMs).map((l) => l.id));
  }, [lessons, nowIso]);
  const isOverdue = (l: RejaLessonRow) => overdueIds.has(l.id);
  const upcoming = useMemo(
    () =>
      lessons
        .filter((l) => UPCOMING.includes(l.status) && !overdueIds.has(l.id))
        .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt)),
    [lessons, overdueIds],
  );
  const overdue = useMemo(
    () =>
      lessons
        .filter((l) => overdueIds.has(l.id))
        .sort((a, b) => Date.parse(b.scheduledAt) - Date.parse(a.scheduledAt)),
    [lessons, overdueIds],
  );
  const past = useMemo(
    () =>
      lessons
        .filter((l) => !UPCOMING.includes(l.status))
        .sort((a, b) => Date.parse(b.scheduledAt) - Date.parse(a.scheduledAt)),
    [lessons],
  );
  const [tab, setTab] = useState<Tab>(
    upcoming.length > 0 ? "upcoming" : overdue.length > 0 ? "overdue" : past.length > 0 ? "past" : "upcoming",
  );
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkNote, setBulkNote] = useState("");
  const rows =
    tab === "upcoming"
      ? upcoming
      : tab === "overdue"
        ? overdue
        : tab === "past"
          ? past
          : [...upcoming, ...overdue, ...past];
  const removable = overdue.filter((l) => !l.planLocked);

  const removeOverdue = async () => {
    const ok = await confirmAction({
      title: `${removable.length} ta darsni o‘chirasizmi?`,
      message: "O‘tkazilmagan barcha darslar rejadan olib tashlanadi. Bu amalni qaytarib bo‘lmaydi.",
      confirmLabel: "Hammasini o‘chirish",
    });
    if (!ok) return;
    setBulkBusy(true);
    setBulkNote("");
    let removed = 0;
    let lastError = "";
    for (const lesson of removable) {
      const res = await fetch(`/api/teacher/lessons/${lesson.id}`, { method: "DELETE" }).catch(() => null);
      if (res?.ok) removed++;
      else lastError = (res ? ((await res.json().catch(() => ({}))) as { error?: string }).error : "") || "Tarmoq xatosi";
    }
    setBulkBusy(false);
    const failed = removable.length - removed;
    setBulkNote(failed ? `${removed} ta o‘chirildi, ${failed} tasi o‘chmadi: ${lastError}` : "");
    router.refresh();
  };

  const emptyText: Record<Tab, [string, string]> = {
    upcoming: ["Kelgusi dars yo‘q", "Yuqoridan kursga yangi dars qo‘shing."],
    overdue: ["Muddati o‘tgan dars yo‘q", "Barcha rejadagi darslar o‘z vaqtida."],
    past: ["O‘tgan dars yo‘q", "Dars o‘tgach shu yerda chiqadi."],
    all: ["Dars yo‘q", "Yuqoridan kursga yangi dars qo‘shing."],
  };

  return (
    <div className="lx-reja">
      <div className="lx-mc-filters">
        <FilterChips
          value={tab}
          onChange={setTab}
          ariaLabel="Darslar"
          options={[
            { value: "upcoming", label: "Kelgusi", count: upcoming.length },
            ...(overdue.length > 0
              ? [{ value: "overdue" as const, label: "Muddati o‘tgan", count: overdue.length }]
              : []),
            { value: "past", label: "O‘tgan", count: past.length },
            { value: "all", label: "Hammasi", count: lessons.length },
          ]}
        />
      </div>

      {tab === "overdue" && overdue.length > 0 ? (
        <div className="lx-reja-overdue" role="status">
          <p>
            Bu darslar belgilangan vaqtda boshlanmagan. Hozir o‘tishingiz, yangi vaqt qo‘yishingiz yoki rejadan olib
            tashlashingiz mumkin — o‘quvchilar jadvalida ham shunday ko‘rinadi.
          </p>
          {removable.length > 1 ? (
            <button type="button" className="btn btn-sm btn-danger" disabled={bulkBusy} onClick={() => void removeOverdue()}>
              {bulkBusy ? "O‘chirilmoqda…" : `Hammasini o‘chirish (${removable.length})`}
            </button>
          ) : null}
          {bulkNote ? (
            <p className="lx-field-err" role="alert">
              {bulkNote}
            </p>
          ) : null}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="lx-mc-empty">
          <h2>{emptyText[tab][0]}</h2>
          <p>{emptyText[tab][1]}</p>
          {tab === "upcoming" && overdue.length > 0 ? (
            <button type="button" className="btn btn-primary" onClick={() => setTab("overdue")}>
              Muddati o‘tgan darslar ({overdue.length})
            </button>
          ) : null}
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
                const late = isOverdue(lesson);
                return (
                  <tr key={lesson.id} className={open ? "is-live" : late ? "is-overdue" : undefined}>
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
                      {late ? (
                        <span className="badge warn">O‘tkazilmagan</span>
                      ) : (
                        <span className={`badge ${statusTone(lesson.status, { hasRecording: ready })}`}>
                          {statusLabel(lesson.status, { hasRecording: ready })}
                        </span>
                      )}
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
                        overdue={late}
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
