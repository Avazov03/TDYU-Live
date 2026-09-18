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
}: {
  lessonId: string;
  status: string;
  streamKey?: string | null;
  titleUz: string;
  summaryUz?: string | null;
  coverUrl?: string | null;
  scheduledAt: string;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div className="row gap-8" style={{ flexWrap: "wrap" }}>
        {status === "scheduled" ? (
          <Link href={`/teacher/live/${lessonId}`} className="btn btn-primary btn-sm">
            Studioga — shu dars
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
      {status === "live" || status === "lobby" ? (
        <p className="small muted" style={{ margin: 0 }}>
          Efir/kutish faqat shu dars sahifasida ochiladi.
        </p>
      ) : null}
      <EditLessonPanel
        lessonId={lessonId}
        status={status}
        titleUz={titleUz}
        summaryUz={summaryUz}
        coverUrl={coverUrl}
        scheduledAt={scheduledAt}
      />
    </div>
  );
}
