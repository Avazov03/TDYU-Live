"use client";

import { useMemo, useState } from "react";
import { IssueCertificateButton } from "@/components/teacher/IssueCertificateButton";
import { EmptyGuide } from "@/components/cabinet/EmptyGuide";
import { TARIFF_LABELS } from "@/lib/tariffs";
import type { TariffTier } from "@/generated/prisma/client";

type StudentRow = {
  subscriptionId: string;
  userId: string;
  fullName: string;
  email: string;
  tier: TariffTier;
  endsAt: string;
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

const TIERS: TariffTier[] = ["t3", "t2", "t1"];

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("uz-UZ", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function daysLeft(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function matchesFilter(s: StudentRow, filter: Filter) {
  if (filter === "all") return true;
  if (filter === "t3") return s.tier === "t3";
  if (filter === "expiring") return daysLeft(s.endsAt) <= 7 && daysLeft(s.endsAt) >= 0;
  if (filter === "silent") return s.attended === 0;
  // attention: past past or low attendance or expiring
  const left = daysLeft(s.endsAt);
  return s.attended === 0 || (s.lessonCount > 0 && s.pct < 50) || (left <= 7 && left >= 0);
}

function attentionWhy(s: StudentRow) {
  const reasons: string[] = [];
  if (s.attended === 0) reasons.push("Hali dars ochmagan");
  else if (s.lessonCount > 0 && s.pct < 50) reasons.push("Davomat past");
  const left = daysLeft(s.endsAt);
  if (left <= 7 && left >= 0) reasons.push(`${left} kun qoldi`);
  return reasons.join(" · ");
}

export function TeacherGroupBoard({ courses }: { courses: CourseBlock[] }) {
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

  if (courses.length === 0) {
    return (
      <EmptyGuide
        title="Hali kurs yo‘q"
        text="Avval Rejada dars qo‘shing. O‘quvchilar obuna bo‘lgach shu yerda chiqadi."
        href="/teacher/reja"
        cta="Dars rejaga"
      />
    );
  }

  return (
    <div className="lx-board">
      <p className="lx-kicker">Guruh</p>
      <h2>Kimga e’tibor berish kerak</h2>
      <p className="muted small lx-lead">
        Filtrlar bilan past davomat, tugayotgan obuna va 3-tarifni tez topasiz.
      </p>

      <div className="staff-toolbar" style={{ marginBottom: 18 }}>
        <select className="staff-filter" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="all">Barcha kurslar</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.titleUz} ({c.activeCount})
            </option>
          ))}
        </select>
        <select className="staff-filter" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
          <option value="attention">Diqqat ({attentionCount})</option>
          <option value="all">Barchasi</option>
          <option value="t3">3-tarif</option>
          <option value="expiring">7 kunda tugaydi</option>
          <option value="silent">Hali ochmagan</option>
        </select>
      </div>

      {visible.every((c) => c.students.length === 0) ? (
        <div className="lx-empty">
          <h3>Bu filtrda odam yo‘q</h3>
          <p className="muted small">Barcha o‘quvchilarni ko‘rish uchun filtrni o‘zgartiring.</p>
          <button type="button" className="btn btn-primary" onClick={() => setFilter("all")}>
            Barchasini ko‘rsat
          </button>
        </div>
      ) : null}

      {visible.map((course) => (
        <section key={course.id} className="lx-group">
          <h3>{course.titleUz}</h3>
          <div className="studio-kpis" style={{ marginBottom: 14 }}>
            <div className="studio-kpi">
              <span className="small muted">Ko‘rinayotgan</span>
              <b>{course.students.length}</b>
            </div>
            <div className="studio-kpi">
              <span className="small muted">1 / 2 / 3</span>
              <b>
                {course.t1} / {course.t2} / {course.t3}
              </b>
            </div>
            <div className="studio-kpi">
              <span className="small muted">O‘rtacha davomat</span>
              <b>{course.lessonCount ? `${course.attendPct}%` : "—"}</b>
            </div>
          </div>

          {course.students.length === 0 ? (
            <p className="muted small">Bu kursda filtrga mos o‘quvchi yo‘q.</p>
          ) : (
            TIERS.map((tier) => {
              const students = course.students.filter((s) => s.tier === tier);
              if (students.length === 0) return null;
              return (
                <div key={tier} style={{ marginBottom: 16 }}>
                  <div className="row gap-8" style={{ marginBottom: 8 }}>
                    <span className="badge accent">{TARIFF_LABELS[tier]}</span>
                    <span className="small muted">
                      {TIER_NOTES[tier]} · {students.length} ta
                    </span>
                  </div>
                  <div className="lx-stack">
                    {students.map((s) => (
                      <article key={s.subscriptionId} className="lx-row">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p className="lx-kicker">
                            {filter === "attention" ? attentionWhy(s) || TARIFF_LABELS[tier] : TARIFF_LABELS[tier]}
                          </p>
                          <h3>{s.fullName}</h3>
                          <p className="small muted" style={{ margin: 0 }}>
                            {s.email} · davomat {s.attended}/{s.lessonCount} ({s.pct}%) · gacha {formatWhen(s.endsAt)}
                          </p>
                          {s.seenTitles.length > 0 ? (
                            <p className="small muted" style={{ margin: "6px 0 0" }}>
                              Ochgan: {s.seenTitles.slice(0, 3).join(", ")}
                              {s.seenTitles.length > 3 ? "…" : ""}
                            </p>
                          ) : null}
                        </div>
                        <div style={{ flexShrink: 0 }}>
                          {tier === "t1" ? (
                            <span className="small muted">Yozuv tarifi</span>
                          ) : s.hasCert ? (
                            <span className="badge success">Sertifikat</span>
                          ) : (
                            <IssueCertificateButton courseId={course.id} userId={s.userId} />
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </section>
      ))}
    </div>
  );
}
