import { AppShell } from "@/components/layout/AppShell";
import { CourseCard } from "@/components/course/CourseCard";
import { requireAppUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  await requireAppUser(`/search${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  const query = q?.trim() ?? "";

  const courses =
    query.length >= 2
      ? await prisma.course.findMany({
          where: {
            isPublished: true,
            OR: [
              { titleUz: { contains: query, mode: "insensitive" } },
              { descriptionUz: { contains: query, mode: "insensitive" } },
              { teacher: { fullName: { contains: query, mode: "insensitive" } } },
              { subject: { nameUz: { contains: query, mode: "insensitive" } } },
              { faculty: { nameUz: { contains: query, mode: "insensitive" } } },
            ],
          },
          include: {
            teacher: { select: { fullName: true } },
            faculty: { select: { nameUz: true } },
            subject: { select: { nameUz: true } },
            _count: { select: { lessons: true } },
          },
          take: 24,
        })
      : [];

  return (
    <AppShell active="catalog">
      <h2 style={{ marginBottom: 8 }}>Qidiruv</h2>
      {!query ? (
        <p className="muted">Kurs, fan yoki o&apos;qituvchi nomini yozing.</p>
      ) : courses.length === 0 ? (
        <div className="empty">&quot;{query}&quot; bo&apos;yicha hech narsa topilmadi.</div>
      ) : (
        <>
          <p className="muted small" style={{ marginBottom: 16 }}>
            {courses.length} ta natija
          </p>
          <div className="search-list">
            {courses.map((c) => (
              <CourseCard
                key={c.id}
                variant="search"
                course={{
                  id: c.id,
                  titleUz: c.titleUz,
                  descriptionUz: c.descriptionUz,
                  priceT1: c.priceT1,
                  teacherName: c.teacher.fullName,
                  facultyName: c.faculty.nameUz,
                  subjectName: c.subject.nameUz,
                  lessonCount: c._count.lessons,
                }}
              />
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
