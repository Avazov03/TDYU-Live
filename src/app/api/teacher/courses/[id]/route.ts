import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTeacherForUser } from "@/lib/teacher";
import { isCourseReviewV1Enabled } from "@/lib/feature-flags";
import { isTeacherEditableLifecycle } from "@/lib/course-review-policy";
import { writeAuditLog } from "@/lib/audit-log";

const patchSchema = z.object({
  titleUz: z.string().trim().min(2).max(120).optional(),
  descriptionUz: z.string().trim().max(2000).optional(),
  topicUz: z.string().trim().max(200).optional().or(z.literal("")),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isCourseReviewV1Enabled()) {
    return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
  }
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }
  const teacher = await getTeacherForUser(session.user.id);
  if (!teacher) return NextResponse.json({ error: "Profil yo'q" }, { status: 404 });

  const { id } = await params;
  const course = await prisma.course.findFirst({
    where: { id, teacherId: teacher.id },
    select: { id: true, lifecycleStatus: true },
  });
  if (!course) return NextResponse.json({ error: "Kurs topilmadi" }, { status: 404 });
  if (!isTeacherEditableLifecycle(course.lifecycleStatus)) {
    return NextResponse.json(
      { error: "Kursni faqat qoralama yoki o‘zgartirish so‘ralgan holatda tahrirlash mumkin" },
      { status: 409 },
    );
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Noto'g'ri ma'lumot" }, { status: 400 });
  }

  const updated = await prisma.course.update({
    where: { id: course.id },
    data: {
      ...(parsed.data.titleUz != null ? { titleUz: parsed.data.titleUz } : {}),
      ...(parsed.data.descriptionUz != null ? { descriptionUz: parsed.data.descriptionUz } : {}),
      ...(parsed.data.topicUz !== undefined ? { topicUz: parsed.data.topicUz || null } : {}),
    },
    select: { id: true, titleUz: true, descriptionUz: true, topicUz: true, lifecycleStatus: true },
  });
  await writeAuditLog({
    actorId: session.user.id,
    action: "course.teacher_edit",
    entityType: "Course",
    entityId: course.id,
    metadata: { fields: Object.keys(parsed.data) },
  });
  return NextResponse.json({ course: updated });
}
