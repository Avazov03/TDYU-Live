import { AdminCoursesManager } from "@/components/admin/AdminCoursesManager";
import { prisma } from "@/lib/prisma";
import { isSubscriptionActive } from "@/lib/tariffs";

export const dynamic = "force-dynamic";

export default async function AdminCoursesPage() {
  const [courses, teachers, faculties, subjects] = await Promise.all([
    prisma.course.findMany({
      include: {
        teacher: { select: { fullName: true } },
        faculty: { select: { nameUz: true } },
        subject: { select: { nameUz: true } },
        subscriptions: { select: { endsAt: true } },
        _count: { select: { lessons: true, subscriptions: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.teacher.findMany({ select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
    prisma.faculty.findMany({ orderBy: { order: "asc" } }),
    prisma.subject.findMany(),
  ]);

  return (
    <AdminCoursesManager
      courses={courses.map((c) => ({
        id: c.id,
        titleUz: c.titleUz,
        teacherName: c.teacher.fullName,
        facultyName: c.faculty.nameUz,
        subjectName: c.subject.nameUz,
        priceT1: c.priceT1,
        priceT2: c.priceT2,
        priceT3: c.priceT3,
        lessonCount: c._count.lessons,
        studentCount: c._count.subscriptions,
        activeStudentCount: c.subscriptions.filter((s) => isSubscriptionActive(s.endsAt)).length,
      }))}
      teachers={teachers}
      faculties={faculties.map((f) => ({ id: f.id, nameUz: f.nameUz }))}
      subjects={subjects.map((s) => ({ id: s.id, facultyId: s.facultyId, nameUz: s.nameUz }))}
    />
  );
}
