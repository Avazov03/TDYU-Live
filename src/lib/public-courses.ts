import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const PUBLIC_COURSES_PAGE_SIZE = 9;

export type PublicCourseCardData = {
  id: string;
  title: string;
  description: string;
  teacherName: string;
  subjectName: string;
  lessonCount: number;
  nextLessonAt: Date | null;
  started: boolean;
  price: number | null;
};

export type PublicCoursePage = {
  items: PublicCourseCardData[];
  total: number;
  page: number;
  pages: number;
};

/** Announced and still running: completed/cancelled/draft/review states never show publicly. */
const PUBLIC_COURSE_WHERE: Prisma.CourseWhereInput = {
  isPublished: true,
  OR: [{ lifecycleStatus: { in: ["published", "upcoming", "active"] } }, { lifecycleStatus: null }],
};

export function parsePageParam(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export async function listPublicCourses(input: {
  page?: number;
  pageSize?: number;
  query?: string;
}): Promise<PublicCoursePage> {
  const pageSize = input.pageSize ?? PUBLIC_COURSES_PAGE_SIZE;
  const query = input.query?.trim() ?? "";
  const where: Prisma.CourseWhereInput =
    query.length >= 2
      ? {
          AND: [
            PUBLIC_COURSE_WHERE,
            {
              OR: [
                { titleUz: { contains: query, mode: "insensitive" } },
                { descriptionUz: { contains: query, mode: "insensitive" } },
                { teacher: { fullName: { contains: query, mode: "insensitive" } } },
                { subject: { nameUz: { contains: query, mode: "insensitive" } } },
                { faculty: { nameUz: { contains: query, mode: "insensitive" } } },
              ],
            },
          ],
        }
      : PUBLIC_COURSE_WHERE;

  const total = await prisma.course.count({ where });
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, input.page ?? 1), pages);
  const now = new Date();

  const rows = await prisma.course.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      titleUz: true,
      descriptionUz: true,
      listPrice: true,
      priceT1: true,
      lifecycleStatus: true,
      teacher: { select: { fullName: true } },
      subject: { select: { nameUz: true } },
      lessons: {
        where: { status: { not: "cancelled" } },
        select: { scheduledAt: true, status: true },
        orderBy: { scheduledAt: "asc" },
      },
    },
  });

  const items = rows.map((c): PublicCourseCardData => {
    const next = c.lessons.find((l) => l.status === "scheduled" && l.scheduledAt >= now);
    const started =
      c.lifecycleStatus === "active" || c.lessons.some((l) => l.status !== "scheduled");
    return {
      id: c.id,
      title: c.titleUz,
      description: c.descriptionUz,
      teacherName: c.teacher.fullName,
      subjectName: c.subject.nameUz,
      lessonCount: c.lessons.length,
      nextLessonAt: next?.scheduledAt ?? null,
      started,
      price: c.listPrice,
    };
  });

  return { items, total, page, pages };
}
