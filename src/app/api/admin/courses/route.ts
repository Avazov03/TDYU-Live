import { NextResponse } from "next/server";
import { z } from "zod";
import { auth, isAdminRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isCourseReviewV1Enabled } from "@/lib/feature-flags";
import { PLATFORM_PRICES } from "@/lib/tariffs";
import { writeAuditLog } from "@/lib/audit-log";

const base = {
  titleUz: z.string().trim().min(2, "Kurs nomini kiriting"),
  descriptionUz: z.string().trim().min(2, "Tavsif yozing"),
  teacherId: z.string().trim().min(1, "O‘qituvchini tanlang"),
  facultyId: z.string().trim().min(1, "Fakultetni tanlang"),
  subjectId: z.string().trim().min(1, "Fanni tanlang"),
};

/** Legacy flow only: the tariff triad is still the price. */
const legacySchema = z.object({
  ...base,
  priceT1: z.number().int().min(0),
  priceT2: z.number().int().min(0),
  priceT3: z.number().int().min(0),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const reviewFlow = isCourseReviewV1Enabled();

  if (!reviewFlow) {
    const parsed = legacySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Noto'g'ri ma'lumot" }, { status: 400 });
    const course = await prisma.course.create({ data: parsed.data });
    return NextResponse.json({ course }, { status: 201 });
  }

  // Review flow: an admin-made course is a draft like any other — the price is set on approval.
  const parsed = z.object(base).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Noto'g'ri ma'lumot" },
      { status: 400 },
    );
  }
  const subject = await prisma.subject.findFirst({
    where: { id: parsed.data.subjectId, facultyId: parsed.data.facultyId },
    select: { id: true },
  });
  if (!subject) return NextResponse.json({ error: "Fan shu fakultetga tegishli emas" }, { status: 400 });
  const teacher = await prisma.teacher.findUnique({ where: { id: parsed.data.teacherId }, select: { id: true } });
  if (!teacher) return NextResponse.json({ error: "O‘qituvchi topilmadi" }, { status: 400 });

  const course = await prisma.course.create({
    data: {
      ...parsed.data,
      priceT1: PLATFORM_PRICES.t1,
      priceT2: PLATFORM_PRICES.t2,
      priceT3: PLATFORM_PRICES.t3,
      isPublished: false,
      lifecycleStatus: "draft",
      createdByUserId: session.user.id,
    },
  });
  await writeAuditLog({
    actorId: session.user.id,
    action: "course.draft_created",
    entityType: "Course",
    entityId: course.id,
    metadata: { by: "admin", teacherId: parsed.data.teacherId },
  });
  return NextResponse.json({ course }, { status: 201 });
}
