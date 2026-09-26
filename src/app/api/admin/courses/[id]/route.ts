import { NextResponse } from "next/server";
import { z } from "zod";
import { auth, isAdminRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isCourseReviewV1Enabled } from "@/lib/feature-flags";
import { writeAuditLog } from "@/lib/audit-log";

const patchSchema = z.object({
  titleUz: z.string().trim().min(2).optional(),
  descriptionUz: z.string().trim().min(2).optional(),
  teacherId: z.string().trim().min(1).optional(),
  facultyId: z.string().trim().min(1).optional(),
  subjectId: z.string().trim().min(1).optional(),
  priceT1: z.number().int().min(0).optional(),
  priceT2: z.number().int().min(0).optional(),
  priceT3: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Noto'g'ri ma'lumot" }, { status: 400 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "O'zgarish yo'q" }, { status: 400 });
  }

  const existing = await prisma.course.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Kurs topilmadi" }, { status: 404 });
  }

  if (
    isCourseReviewV1Enabled() &&
    existing.lifecycleStatus != null &&
    parsed.data.isPublished !== undefined
  ) {
    return NextResponse.json(
      { error: "Bu kurs tekshiruv jarayonida boshqariladi — «Tekshiruv» bo‘limidan foydalaning" },
      { status: 409 },
    );
  }

  const course = await prisma.course.update({
    where: { id },
    data: parsed.data,
  });

  await writeAuditLog({
    actorId: session.user.id,
    action: "course.admin_update",
    entityType: "Course",
    entityId: id,
    metadata: {
      changes: Object.fromEntries(
        Object.entries(parsed.data).map(([key, value]) => [
          key,
          { from: (existing as Record<string, unknown>)[key] ?? null, to: value },
        ]),
      ),
    },
  });

  return NextResponse.json({ course });
}
