import Link from "next/link";
import type { PublicCourseCardData } from "@/lib/public-courses";
import { formatSom } from "@/lib/tariffs";
import { formatDateTime, initials } from "@/lib/utils";

export function thumbTone(id: string) {
  const n = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return `tone-${(n % 6) + 1}`;
}

export function PublicCourseCard({
  course,
  showPrice,
}: {
  course: PublicCourseCardData;
  showPrice: boolean;
}) {
  const status = course.started ? "Davom etmoqda" : "Tez orada";
  return (
    <Link href={`/courses/${course.id}`} className="lx-ccard" data-testid="public-course-card">
      <div className={`lx-ccard-thumb course-thumb ${thumbTone(course.id)}`}>
        <span className={`lx-ccard-status${course.started ? " is-live" : ""}`}>{status}</span>
        <span className="lx-ccard-count">{course.lessonCount} dars</span>
      </div>
      <div className="lx-ccard-body">
        <p className="lx-ccard-subject">{course.subjectName}</p>
        <h3 className="lx-ccard-title">{course.title}</h3>
        {course.description ? <p className="lx-ccard-desc">{course.description}</p> : null}
        <div className="lx-ccard-teacher">
          <span className="avatar sm" aria-hidden>
            {initials(course.teacherName)}
          </span>
          <span>{course.teacherName}</span>
        </div>
        <p className="lx-ccard-when">
          {course.nextLessonAt
            ? `${course.started ? "Keyingi dars" : "Boshlanishi"}: ${formatDateTime(course.nextLessonAt)}`
            : course.started
              ? "Darslar davom etmoqda"
              : "Sana tez orada e’lon qilinadi"}
        </p>
      </div>
      <div className="lx-ccard-foot">
        {showPrice && course.price != null ? (
          <span className="lx-ccard-price">{formatSom(course.price)}</span>
        ) : (
          <span />
        )}
        <span className="lx-ccard-go">
          Batafsil <span aria-hidden>→</span>
        </span>
      </div>
    </Link>
  );
}

export function PublicCoursePager({
  page,
  pages,
  hrefFor,
}: {
  page: number;
  pages: number;
  hrefFor: (page: number) => string;
}) {
  if (pages <= 1) return null;
  return (
    <nav className="lx-pager" aria-label="Kurslar sahifalari">
      {page > 1 ? (
        <Link className="btn" href={hrefFor(page - 1)}>
          <span aria-hidden>←</span> Oldingi
        </Link>
      ) : (
        <span className="btn is-disabled" aria-disabled="true">
          <span aria-hidden>←</span> Oldingi
        </span>
      )}
      <span className="lx-pager-count">
        {page} / {pages}
      </span>
      {page < pages ? (
        <Link className="btn btn-primary" href={hrefFor(page + 1)} data-testid="public-courses-next">
          Keyingi <span aria-hidden>→</span>
        </Link>
      ) : (
        <span className="btn is-disabled" aria-disabled="true">
          Keyingi <span aria-hidden>→</span>
        </span>
      )}
    </nav>
  );
}
