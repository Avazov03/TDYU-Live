import Link from "next/link";
import { initials } from "@/lib/utils";
import { formatSom } from "@/lib/tariffs";

export type CourseCardData = {
  id: string;
  titleUz: string;
  descriptionUz: string;
  priceT1: number;
  teacherName: string;
  facultyName: string;
  subjectName: string;
  lessonCount: number;
};

function thumbTone(id: string) {
  const n = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return `tone-${(n % 6) + 1}`;
}

export function CourseCard({
  course,
  badge,
  variant = "grid",
}: {
  course: CourseCardData;
  badge?: string;
  variant?: "grid" | "search";
}) {
  const tone = thumbTone(course.id);
  const thumb = (
    <div className={`${variant === "search" ? "search-thumb" : "thumb"} course-thumb ${tone}`}>
      {badge ? <span className="thumb-flag">{badge}</span> : null}
      <span className="thumb-play" aria-hidden>
        ▶
      </span>
      <span className="dur">{course.lessonCount} dars</span>
    </div>
  );

  if (variant === "search") {
    return (
      <Link href={`/courses/${course.id}`} className="search-result">
        {thumb}
        <div className="search-meta">
          <h3>{course.titleUz}</h3>
          <p>
            {course.subjectName} · {formatSom(course.priceT1)} dan
          </p>
          <div className="row gap-8" style={{ margin: "8px 0" }}>
            <span className="avatar sm">{initials(course.teacherName)}</span>
            <span className="small muted">{course.teacherName}</span>
          </div>
          <p className="search-desc">{course.descriptionUz}</p>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/courses/${course.id}`} className="vcard">
      {thumb}
      <div className="vmeta">
        <span className="avatar sm">{initials(course.teacherName)}</span>
        <div className="vinfo">
          <h3>{course.titleUz}</h3>
          <p>{course.teacherName}</p>
          <p>
            {course.subjectName} · {formatSom(course.priceT1)} dan
          </p>
        </div>
      </div>
    </Link>
  );
}
