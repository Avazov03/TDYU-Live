import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveEntitlement, getAnyActiveSubscription } from "@/lib/access";
import { ensureTeacherWorkspace } from "@/lib/teacher-workspace";
import { isStudentRole } from "@/lib/roles";

const schema = z.object({
  teacherId: z.string().trim().min(1),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !isStudentRole(session.user.role)) {
    return NextResponse.json({ error: "Kirish kerak" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "O'qituvchi tanlanmadi" }, { status: 400 });
  }

  const entitlement = await getActiveEntitlement(session.user.id);
  if (!entitlement) {
    return NextResponse.json({ error: "Avval tarif to'lang" }, { status: 403 });
  }

  const teacher = await prisma.teacher.findUnique({
    where: { id: parsed.data.teacherId },
    include: { subject: true },
  });
  if (!teacher || !teacher.userId) {
    return NextResponse.json({ error: "Bu o'qituvchi hali kabinet ochmagan" }, { status: 404 });
  }

  const courseId = await ensureTeacherWorkspace(teacher.id);
  if (!courseId) {
    return NextResponse.json({ error: "Kurs ochilmadi" }, { status: 500 });
  }

  await prisma.course.update({
    where: { id: courseId },
    data: { isPublished: true },
  });

  const userId = session.user.id;
  const others = await prisma.subscription.findMany({
    where: { userId, courseId: { not: courseId }, endsAt: { gt: new Date() } },
    select: { id: true },
  });
  if (others.length > 0) {
    await prisma.subscription.updateMany({
      where: { id: { in: others.map((s) => s.id) } },
      data: { endsAt: new Date() },
    });
  }

  await prisma.subscription.upsert({
    where: { userId_courseId: { userId, courseId } },
    update: {
      tier: entitlement.tier,
      startsAt: entitlement.startsAt,
      endsAt: entitlement.endsAt,
    },
    create: {
      userId,
      courseId,
      tier: entitlement.tier,
      startsAt: entitlement.startsAt,
      endsAt: entitlement.endsAt,
    },
  });

  const sub = await getAnyActiveSubscription(userId);
  return NextResponse.json({ ok: true, courseId, teacherName: teacher.fullName, courseTitle: sub?.course.titleUz });
}
