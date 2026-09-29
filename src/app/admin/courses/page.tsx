import Link from "next/link";
import { AdminCoursesBoard } from "@/components/admin/AdminCoursesBoard";
import { AdminCreateCourseDialog } from "@/components/admin/AdminCreateCourseDialog";
import { countPendingReviews, getAdminCourseBoard } from "@/lib/admin-courses";
import { getEnrollmentAccessMode, isCourseReviewV1Enabled } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

export default async function AdminCoursesPage() {
  const reviewFlow = isCourseReviewV1Enabled();
  const seatMode = getEnrollmentAccessMode() === "enrollment";
  const [board, pending] = await Promise.all([
    getAdminCourseBoard(),
    reviewFlow ? countPendingReviews() : Promise.resolve(0),
  ]);
  return (
    <div className="admin-board">
      <header className="lx-mc-head lx-admin-head">
        <div>
          <p className="lx-kicker">Kurslar</p>
          <h1 className="lx-mc-title">Kurslar</h1>
          <p className="lx-mc-sub">
            {board.summary.courses} ta kurs · {board.summary.teachers} ta o‘qituvchi
          </p>
        </div>
        <AdminCreateCourseDialog
          teachers={board.teachers}
          faculties={board.faculties}
          subjects={board.subjects}
          reviewFlow={reviewFlow}
        />
      </header>
      {pending > 0 ? (
        <Link href="/admin/review" className="lx-review-banner" data-testid="review-banner">
          <span>
            <b>{pending} ta kurs</b> tekshiruv yoki nashrni kutmoqda
          </span>
          <span className="lx-review-banner-cta">Tekshiruvga o‘tish →</span>
        </Link>
      ) : null}
      <AdminCoursesBoard
        groups={board.groups}
        courses={board.courses}
        teachers={board.teachers}
        faculties={board.faculties}
        subjects={board.subjects}
        summary={board.summary}
        reviewFlow={reviewFlow}
        seatMode={seatMode}
      />
    </div>
  );
}
