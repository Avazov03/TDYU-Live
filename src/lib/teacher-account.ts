import type { Teacher, User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { randomTeacherPassword } from "@/lib/impersonate";

type TeacherWithUser = Teacher & { user: User | null };

export async function ensureTeacherUser(
  teacherId: string,
  password?: string,
): Promise<{ ok: true; teacher: TeacherWithUser; user: User } | { ok: false; error: string; status: number }> {
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    include: { user: true },
  });
  if (!teacher) return { ok: false, error: "O'qituvchi topilmadi", status: 404 };

  if (teacher.userId && teacher.user) {
    if (teacher.user.role !== "teacher") {
      return { ok: false, error: "Bu hisob o'qituvchi emas", status: 400 };
    }
    if (password) {
      const user = await prisma.user.update({
        where: { id: teacher.user.id },
        data: { passwordHash: await hashPassword(password), isBlocked: false },
      });
      return { ok: true, teacher, user };
    }
    return { ok: true, teacher, user: teacher.user };
  }

  const email = teacher.contactEmail.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.role !== "teacher") {
    return {
      ok: false,
      error: "Bu email boshqa rol bilan band. Avval invite orqali bog'lang.",
      status: 409,
    };
  }

  const passwordHash = await hashPassword(password || randomTeacherPassword());
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          role: "teacher",
          isBlocked: false,
          fullName: teacher.fullName,
          passwordHash,
        },
      })
    : await prisma.user.create({
        data: {
          email,
          fullName: teacher.fullName,
          passwordHash,
          role: "teacher",
        },
      });

  await prisma.teacher.update({
    where: { id: teacher.id },
    data: { userId: user.id },
  });

  return { ok: true, teacher, user };
}
