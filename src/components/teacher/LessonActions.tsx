"use client";

import Link from "next/link";
import { EditLessonPanel } from "@/components/teacher/EditLessonPanel";

export function LessonActions({
  lessonId,
  status,
  titleUz,
  summaryUz,
  coverUrl,
  scheduledAt,
  courseGate,
  planLocked = false,
}: {
  lessonId: string;
  status: string;
  streamKey?: string | null;
  titleUz: string;
  summaryUz?: string | null;
  coverUrl?: string | null;
  scheduledAt: string;
  courseGate?: { label: string; canSubmit: boolean } | null;
  planLocked?: boolean;
}) {
  return (
    <div className="lx-lesson-actions">
      <div className="row gap-8" style={{ flexWrap: "wrap" }}>
        {status === "scheduled" && courseGate ? (
          courseGate.canSubmit ? (
            <Link href="/teacher#kurslar" className="btn btn-primary btn-sm">
              Tekshiruvga yuborish
            </Link>
          ) : planLocked ? null : (
            <span className="lx-lesson-wait">Efir nashrdan keyin</span>
          )
        ) : null}
        {status === "scheduled" && !courseGate ? (
          <Link href={`/teacher/live/${lessonId}`} className="btn btn-primary btn-sm">
            Studioga kirish
          </Link>
        ) : null}
        {status === "lobby" ? (
          <Link href={`/teacher/live/${lessonId}`} className="btn btn-primary btn-sm">
            Kutish xonasiga
          </Link>
        ) : null}
        {status === "live" ? (
          <Link href={`/teacher/live/${lessonId}`} className="btn btn-danger btn-sm">
            Efirni boshqarish
          </Link>
        ) : null}
      </div>
      {planLocked ? (
        <span className="lx-lesson-wait" title="Kurs tekshiruvda — reja muzlatilgan">
          Reja muzlatilgan
        </span>
      ) : (
        <EditLessonPanel
          lessonId={lessonId}
          status={status}
          titleUz={titleUz}
          summaryUz={summaryUz}
          coverUrl={coverUrl}
          scheduledAt={scheduledAt}
        />
      )}
    </div>
  );
}
