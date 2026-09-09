import { AdminTeachersManager, type InviteRow, type TeacherRow } from "@/components/admin/AdminTeachersManager";
import { prisma } from "@/lib/prisma";
import { inviteUrl } from "@/lib/invite";

export const dynamic = "force-dynamic";

function teacherStatus(hasAccount: boolean, isBlocked: boolean): TeacherRow["status"] {
  if (isBlocked) return "blocked";
  if (!hasAccount) return "invite";
  return "active";
}

export default async function AdminTeachersPage() {
  const now = new Date();
  const [teachers, faculties, subjects, invites] = await Promise.all([
    prisma.teacher.findMany({
      include: {
        faculty: true,
        subject: true,
        user: {
          select: {
            email: true,
            lastLoginAt: true,
            isBlocked: true,
            passwordHash: true,
          },
        },
        invites: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { courses: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.faculty.findMany({ orderBy: { order: "asc" } }),
    prisma.subject.findMany({ orderBy: { nameUz: "asc" } }),
    prisma.teacherInvite.findMany({
      where: { usedAt: null, expiresAt: { gt: now } },
      include: { teacher: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const teacherRows: TeacherRow[] = teachers.map((t) => {
    const hasAccount = Boolean(t.userId);
    const isBlocked = Boolean(t.user?.isBlocked);
    const latestInvite = t.invites[0] && !t.invites[0].usedAt ? inviteUrl(t.invites[0].token) : null;
    return {
      id: t.id,
      fullName: t.fullName,
      contactEmail: t.contactEmail,
      login: t.user?.email ?? t.contactEmail,
      facultyName: t.faculty.nameUz,
      subjectName: t.subject.nameUz,
      hasAccount,
      hasPassword: Boolean(t.user?.passwordHash),
      isBlocked,
      status: teacherStatus(hasAccount, isBlocked),
      lastLoginAt: t.user?.lastLoginAt?.toISOString() ?? null,
      inviteUrl: latestInvite,
      courseCount: t._count.courses,
    };
  });

  const inviteRows: InviteRow[] = invites.map((i) => ({
    id: i.id,
    teacherId: i.teacher.id,
    teacherName: i.teacher.fullName,
    url: inviteUrl(i.token),
    expiresAt: i.expiresAt.toISOString(),
  }));

  return (
    <AdminTeachersManager
      teachers={teacherRows}
      invites={inviteRows}
      faculties={faculties.map((f) => ({ id: f.id, nameUz: f.nameUz }))}
      subjects={subjects.map((s) => ({ id: s.id, facultyId: s.facultyId, nameUz: s.nameUz }))}
    />
  );
}
