import { AdminCoursesBoard } from "@/components/admin/AdminCoursesBoard";
import { AdminCourseReviewQueue } from "@/components/admin/AdminCourseReviewQueue";
import { getAdminCourseBoard, getAdminReviewQueue } from "@/lib/admin-courses";
import { isCourseReviewV1Enabled } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

export default async function AdminCoursesPage() {
  const reviewFlow = isCourseReviewV1Enabled();
  const [board, queue] = await Promise.all([
    getAdminCourseBoard(),
    reviewFlow ? getAdminReviewQueue() : Promise.resolve([]),
  ]);
  return (
    <>
      {reviewFlow ? <AdminCourseReviewQueue courses={queue} /> : null}
      <AdminCoursesBoard
        groups={board.groups}
        courses={board.courses}
        teachers={board.teachers}
        faculties={board.faculties}
        subjects={board.subjects}
        summary={board.summary}
        reviewFlow={reviewFlow}
      />
    </>
  );
}
