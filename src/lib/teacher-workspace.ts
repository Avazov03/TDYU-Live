import { prisma } from "@/lib/prisma";
import { PLATFORM_PRICES } from "@/lib/tariffs";

/** O'qituvchida hech bo'lmaganda bitta kurs bo'lsin — Zoom/Classroom kabi birinchi kundan ish joyi. */
export async function ensureTeacherWorkspace(teacherId: string) {
  const existing = await prisma.course.findFirst({ where: { teacherId }, select: { id: true } });
  if (existing) return existing.id;

  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    include: { subject: true },
  });
  if (!teacher) return null;

  const course = await prisma.course.create({
    data: {
      teacherId: teacher.id,
      facultyId: teacher.facultyId,
      subjectId: teacher.subjectId,
      titleUz: teacher.subject.nameUz,
      descriptionUz: `${teacher.fullName} — ${teacher.subject.nameUz} kursi. Jonli dars va yozuvlar shu yerda.`,
      priceT1: PLATFORM_PRICES.t1,
      priceT2: PLATFORM_PRICES.t2,
      priceT3: PLATFORM_PRICES.t3,
    },
    select: { id: true },
  });
  return course.id;
}
