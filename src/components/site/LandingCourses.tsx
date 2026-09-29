import Link from "next/link";
import { PublicCourseCard, PublicCoursePager } from "@/components/course/PublicCourseCard";
import type { PublicCoursePage } from "@/lib/public-courses";

export function LandingCourses({
  data,
  showPrice,
  showSearch,
}: {
  data: PublicCoursePage;
  showPrice: boolean;
  showSearch: boolean;
}) {
  return (
    <section id="kurslar" className="lx-section lx-courses" data-testid="landing-course-cta">
      <div className="lx-courses-head">
        <div>
          <p className="lx-kicker">Kurslar</p>
          <h2 className="lx-title">E’lon qilingan kurslar</h2>
          <p className="lx-sub">
            {data.total > 0 ? `${data.total} ta kurs sotuvda.` : "Hozircha e’lon qilingan kurs yo‘q."}
          </p>
        </div>
        {showSearch ? (
          <Link href="/search" className="btn">
            Kurslarni qidirish
          </Link>
        ) : null}
      </div>

      {data.items.length > 0 ? (
        <div className="lx-course-grid" data-testid="public-course-grid">
          {data.items.map((course) => (
            <PublicCourseCard key={course.id} course={course} showPrice={showPrice} />
          ))}
        </div>
      ) : (
        <div className="lx-courses-empty">
          Yangi kurslar e’lon qilinganda shu yerda paydo bo‘ladi.
        </div>
      )}

      <PublicCoursePager
        page={data.page}
        pages={data.pages}
        hrefFor={(p) => (p === 1 ? "/#kurslar" : `/?kurslar=${p}#kurslar`)}
      />
    </section>
  );
}
