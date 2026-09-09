import { AdminTeachersManager } from "@/components/admin/AdminTeachersManager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminTeachersPage() {
  const [teachers, faculties, subjects] = await Promise.all([
    prisma.teacher.findMany({
      include: {
        faculty: true,
        subject: true,
        user: { select: { email: true } },
        invites: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { courses: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.faculty.findMany({ orderBy: { order: "asc" } }),
    prisma.subject.findMany({ orderBy: { nameUz: "asc" } }),
  ]);

  return (
    <AdminTeachersManager
      teachers={teachers.map((t) => ({
        id: t.id,
        fullName: t.fullName,
        contactEmail: t.contactEmail,
        facultyName: t.faculty.nameUz,
        subjectName: t.subject.nameUz,
        hasAccount: Boolean(t.userId),
        inviteUrl: t.invites[0] && !t.invites[0].usedAt ? t.invites[0].token : null,
        courseCount: t._count.courses,
      }))}
      faculties={faculties.map((f) => ({ id: f.id, nameUz: f.nameUz }))}
      subjects={subjects.map((s) => ({ id: s.id, facultyId: s.facultyId, nameUz: s.nameUz }))}
    />
  );
}
