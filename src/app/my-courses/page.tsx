import { AppShell } from "@/components/layout/AppShell";
import { CourseCard } from "@/components/course/CourseCard";
import { requireStudentCabinet } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { TARIFF_LABELS, isSubscriptionActive } from "@/lib/tariffs";

export const dynamic = "force-dynamic";

export default async function MyCoursesPage() {
  const { user } = await requireStudentCabinet("/my-courses");

  const subs = await prisma.subscription.findMany({
    where: { userId: user.id },
    include: {
      course: {
        include: {
          teacher: { select: { fullName: true } },
          faculty: { select: { nameUz: true } },
          subject: { select: { nameUz: true } },
          _count: { select: { lessons: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AppShell active="my-courses">
      <h2 style={{ marginBottom: 16 }}>Mening kurslarim</h2>
      {subs.length === 0 ? (
        <div className="empty">Hali kurs yo&apos;q.</div>
      ) : (
        <div className="grid">
          {subs.map((sub) => {
            const active = isSubscriptionActive(sub.endsAt);
            return (
              <CourseCard
                key={sub.id}
                badge={active ? TARIFF_LABELS[sub.tier] : "Muddati tugagan"}
                course={{
                  id: sub.course.id,
                  titleUz: sub.course.titleUz,
                  descriptionUz: sub.course.descriptionUz,
                  priceT1: sub.course.priceT1,
                  teacherName: sub.course.teacher.fullName,
                  facultyName: sub.course.faculty.nameUz,
                  subjectName: sub.course.subject.nameUz,
                  lessonCount: sub.course._count.lessons,
                }}
              />
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
