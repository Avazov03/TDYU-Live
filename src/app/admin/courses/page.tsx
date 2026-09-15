import { AdminCoursesBoard } from "@/components/admin/AdminCoursesBoard";
import { getAdminCourseBoard } from "@/lib/admin-courses";

export const dynamic = "force-dynamic";

export default async function AdminCoursesPage() {
  const board = await getAdminCourseBoard();
  return (
    <AdminCoursesBoard
      groups={board.groups}
      courses={board.courses}
      teachers={board.teachers}
      faculties={board.faculties}
      subjects={board.subjects}
      summary={board.summary}
    />
  );
}
