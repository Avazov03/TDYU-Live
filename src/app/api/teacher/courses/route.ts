import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTeacherForUser } from "@/lib/teacher";
import { PLATFORM_PRICES } from "@/lib/tariffs";
import { notifyCourseStudents } from "@/lib/notify";

const schema = z.object({
  titleUz: z.string().trim().min(2).max(120),
  descriptionUz: z.string().trim().max(800).optional().or(z.literal("")),
  lessonCount: z.number().int().min(1).max(40),
  firstAt: z.string().min(1),
  intervalDays: z.number().int().min(1).max(30),
  firstTitle: z.string().trim().min(1).max(120),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }
  const teacher = await getTeacherForUser(session.user.id);
  if (!teacher) return NextResponse.json({ error: "Profil yo'q" }, { status: 404 });

  const full = await prisma.teacher.findUnique({
    where: { id: teacher.id },
    include: { subject: true },
  });
  if (!full) return NextResponse.json({ error: "Profil yo'q" }, { status: 404 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Noto'g'ri ma'lumot" }, { status: 400 });

  const firstAt = new Date(parsed.data.firstAt);
  if (Number.isNaN(firstAt.getTime())) {
    return NextResponse.json({ error: "Vaqt noto‘g‘ri" }, { status: 400 });
  }

  const course = await prisma.course.create({
    data: {
      teacherId: full.id,
      facultyId: full.facultyId,
      subjectId: full.subjectId,
      titleUz: parsed.data.titleUz,
      descriptionUz:
        parsed.data.descriptionUz ||
        `${full.fullName} — ${parsed.data.titleUz}. Jonli dars va yozuvlar.`,
      priceT1: PLATFORM_PRICES.t1,
      priceT2: PLATFORM_PRICES.t2,
      priceT3: PLATFORM_PRICES.t3,
      isPublished: true,
      lessons: {
        create: Array.from({ length: parsed.data.lessonCount }, (_, i) => {
          const when = new Date(firstAt);
          when.setDate(when.getDate() + i * parsed.data.intervalDays);
          return {
            titleUz: i === 0 ? parsed.data.firstTitle : `${i + 1}-dars`,
            scheduledAt: when,
            status: "scheduled" as const,
          };
        }),
      },
    },
    include: { lessons: { select: { id: true } } },
  });

  // mavjud obunachilarga (agar bo‘lsa) — yangi kurs odatda bo‘sh
  await notifyCourseStudents(course.id, {
    type: "system",
    titleUz: "Yangi kurs rejasi",
    messageUz: `${parsed.data.titleUz}: ${parsed.data.lessonCount} ta dars rejalashtirildi.`,
    relatedId: course.id,
  }).catch(() => undefined);

  return NextResponse.json({ course }, { status: 201 });
}
