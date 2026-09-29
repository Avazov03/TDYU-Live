"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FilterChips } from "@/components/cabinet/FilterChips";
import { IssueCertificateButton } from "@/components/teacher/IssueCertificateButton";
import { TARIFF_LABELS } from "@/lib/tariffs";
import { UZ_MONTHS_SHORT, initials, tashkentParts } from "@/lib/utils";
import type { TariffTier } from "@/generated/prisma/client";

type StudentRow = {
  rowId: string;
  userId: string;
  fullName: string;
  email: string;
  /** null — course purchase (Enrollment), no tariff tier or end date. */
  tier: TariffTier | null;
  endsAt: string | null;
  attended: number;
  lessonCount: number;
  pct: number;
  hasCert: boolean;
  seenTitles: string[];
};

type CourseBlock = {
  id: string;
  titleUz: string;
  activeCount: number;
  t1: number;
  t2: number;
  t3: number;
  attendPct: number;
  lessonCount: number;
  students: StudentRow[];
};

type Filter = "all" | "attention" | "t3" | "expiring" | "silent";

const TIER_NOTES: Record<TariffTier, string> = {
  t3: "Premium — ustuvor savol va topshiriq",
  t2: "Jonli efir va chat",
  t1: "Faqat yozuv — guruh chatiga kirmaydi",
};

const TIERS: (TariffTier | null)[] = [null, "t3", "t2", "t1"];

function formatWhen(iso: string) {
  const p = tashkentParts(new Date(iso));
  return `${p.day}-${UZ_MONTHS_SHORT[p.monthIndex]}, ${p.year}`;
}

function daysLeft(iso: string | null) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function isExpiring(s: StudentRow) {
  const left = daysLeft(s.endsAt);
  return left != null && left <= 7 && left >= 0;
}

function matchesFilter(s: StudentRow, filter: Filter) {
  if (filter === "all") return true;
  if (filter === "t3") return s.tier === "t3";
  if (filter === "expiring") return isExpiring(s);
  if (filter === "silent") return s.attended === 0;
  return s.attended === 0 || (s.lessonCount > 0 && s.pct < 50) || isExpiring(s);
}

function attentionWhy(s: StudentRow) {
  const reasons: string[] = [];
  if (s.attended === 0) reasons.push("Hali dars ochmagan");
  else if (s.lessonCount > 0 && s.pct < 50) reasons.push("Davomat past");
  if (isExpiring(s)) reasons.push(`${daysLeft(s.endsAt)} kun qoldi`);
  return reasons.join(" · ");
}

export function TeacherGroupBoard({
  courses,
  showTiers = true,
}: {
  courses: CourseBlock[];
  showTiers?: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("attention");
  const [courseId, setCourseId] = useState<string>("all");

  const visible = useMemo(() => {
    return courses
      .filter((c) => courseId === "all" || c.id === courseId)
      .map((course) => ({
        ...course,
        students: course.students.filter((s) => matchesFilter(s, filter)),
      }))
      .filter((c) => filter === "all" || c.students.length > 0 || courseId === c.id);
  }, [courses, filter, courseId]);

  const attentionCount = courses.reduce(
    (n, c) => n + c.students.filter((s) => matchesFilter(s, "attention")).length,
    0,
  );

  const studentTotal = new Set(courses.flatMap((c) => c.students.map((s) => s.userId))).size;
  const silentCount = courses.reduce(
    (n, c) => n + c.students.filter((s) => matchesFilter(s, "silent")).length,
    0,
  );
  const t3Count = courses.reduce((n, c) => n + c.students.filter((s) => s.tier === "t3").length, 0);
  const expiringCount = courses.reduce((n, c) => n + c.students.filter(isExpiring).length, 0);
  const allCount = courses.reduce((n, c) => n + c.students.length, 0);

  const filterOptions: { value: Filter; label: string; count: number }[] = [
    { value: "attention", label: "Diqqat", count: attentionCount },
    { value: "all", label: "Barchasi", count: allCount },
    { value: "silent", label: "Hali ochmagan", count: silentCount },
    ...(showTiers
      ? [
          { value: "t3" as const, label: "3-tarif", count: t3Count },
          { value: "expiring" as const, label: "7 kunda tugaydi", count: expiringCount },
        ]
      : []),
  ];

  return (
    <div className="lx-sc">
      <header className="lx-mc-head">
        <div>
          <p className="lx-kicker">Guruh</p>
          <h1 className="lx-mc-title">O‘quvchilar</h1>
          <p className="lx-mc-sub">
            {courses.length === 0
              ? "Kurs ochilgach o‘quvchilar shu yerda chiqadi"
              : `${studentTotal} ta o‘quvchi · ${attentionCount} tasi e’tibor talab qiladi`}
          </p>
        </div>
      </header>

      {courses.length === 0 ? (
        <div className="lx-mc-empty">
          <h2>Hali kurs yo‘q</h2>
          <p>Avval rejaga dars qo‘shing. O‘quvchilar kursni sotib olgach shu yerda chiqadi.</p>
          <Link href="/teacher/reja" className="btn btn-primary">
            Dars rejasi
          </Link>
        </div>
      ) : (
        <>
          <div className="lx-mc-filters">
            <FilterChips value={filter} onChange={setFilter} ariaLabel="O‘quvchilar filtri" options={filterOptions} />
            {courses.length > 1 ? (
              <select
                className="lx-grp-select"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                aria-label="Kurs"
              >
                <option value="all">Barcha kurslar</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titleUz} ({c.activeCount})
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          {visible.every((c) => c.students.length === 0) ? (
            <div className="lx-mc-empty">
              <h2>{filter === "attention" ? "Hammasi joyida" : "Bu filtrda o‘quvchi yo‘q"}</h2>
              <p>
                {filter === "attention"
                  ? "Hozir e’tibor talab qiladigan o‘quvchi yo‘q."
                  : "Barcha o‘quvchilarni ko‘rish uchun filtrni o‘zgartiring."}
              </p>
              <button type="button" className="btn btn-primary" onClick={() => setFilter("all")}>
                Barchasini ko‘rsat
              </button>
            </div>
          ) : (
            <div className="lx-hist">
              {visible
                .filter((course) => course.students.length > 0)
                .map((course) => (
                  <section key={course.id} className="lx-grp-course">
                    <div className="lx-grp-head">
                      <h2 className="lx-cd-h2">{course.titleUz}</h2>
                      <span className="lx-grp-stats">
                        {course.activeCount} ta o‘quvchi
                        {course.lessonCount ? ` · o‘rtacha davomat ${course.attendPct}%` : ""}
                        {showTiers ? ` · tariflar ${course.t1}/${course.t2}/${course.t3}` : ""}
                      </span>
                    </div>
                    <div className="lx-sc-day">
                      {[...course.students]
                        .sort((a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) || a.pct - b.pct)
                        .map((s) => {
                          const why = attentionWhy(s);
                          return (
                            <article key={s.rowId} className="lx-grp-row" data-testid="group-student">
                              <span className="avatar" aria-hidden>
                                {initials(s.fullName)}
                              </span>
                              <div className="lx-grp-info">
                                <p className="lx-grp-name">
                                  {s.fullName}
                                  {s.tier ? (
                                    <span className="lx-cd-pill" title={TIER_NOTES[s.tier]}>
                                      {TARIFF_LABELS[s.tier]}
                                    </span>
                                  ) : null}
                                  {why ? <span className="lx-cd-pill is-warn">{why}</span> : null}
                                </p>
                                <p className="lx-grp-email">
                                  {s.email}
                                  {s.endsAt ? ` · ${formatWhen(s.endsAt)} gacha` : ""}
                                </p>
                                {s.seenTitles.length > 0 ? (
                                  <p className="lx-grp-seen">
                                    Ochgan: {s.seenTitles.slice(0, 3).join(", ")}
                                    {s.seenTitles.length > 3 ? "…" : ""}
                                  </p>
                                ) : null}
                              </div>
                              <div className="lx-grp-attend">
                                <div className="lx-mc-progress-row">
                                  <span>Davomat</span>
                                  <span>
                                    {s.attended}/{s.lessonCount}
                                  </span>
                                </div>
                                <div className="lx-mc-bar">
                                  <span style={{ width: `${s.pct}%` }} />
                                </div>
                              </div>
                              <div className="lx-grp-action">
                                {s.tier === "t1" ? (
                                  <span className="lx-grp-muted">Yozuv tarifi</span>
                                ) : s.hasCert ? (
                                  <span className="lx-as-state is-done">Sertifikat berilgan</span>
                                ) : (
                                  <IssueCertificateButton courseId={course.id} userId={s.userId} />
                                )}
                              </div>
                            </article>
                          );
                        })}
                    </div>
                  </section>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
