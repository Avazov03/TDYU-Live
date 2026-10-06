import { NextResponse } from "next/server";
import { z } from "zod";
import { auth, isAdminRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findScheduleConflict, lessonEnd } from "@/lib/schedule-policy";
import { loadTeacherLessonWindows } from "@/lib/schedule-guard";
import { notifyCourseStudents } from "@/lib/notify";
import { writeAuditLog } from "@/lib/audit-log";
import { entityIdSchema } from "@/lib/entity-id";

const schema = z.object({ teacherId: entityIdSchema });

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Ruxsat yo‘q" }, { status: 403 });
  }
  const { id } = await params;
  const course = await prisma.course.findUnique({
    where: { id },
    select: { id: true, subjectId: true, teacherId: true, titleUz: true },
  });
  if (!course) return NextResponse.json({ error: "Kurs topilmadi" }, { status: 404 });
  const teachers = await prisma.teacher.findMany({
    where: { subjectId: course.subjectId, userId: { not: null }, NOT: { id: course.teacherId } },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });
  return NextResponse.json({
    teachers,
    emptyHint:
      teachers.length === 0
        ? "Shu fan bo‘yicha boshqa o‘qituvchi yo‘q. Kursni bekor qilib, xaridlarni qaytaring."
        : null,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Ruxsat yo‘q" }, { status: 403 });
  }
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "O‘qituvchini tanlang" }, { status: 400 });

  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      lessons: { select: { id: true, titleUz: true, status: true, scheduledAt: true, scheduledEndAt: true, durationMinutes: true } },
      teacher: { select: { fullName: true } },
    },
  });
  if (!course) return NextResponse.json({ error: "Kurs topilmadi" }, { status: 404 });
  if (course.lifecycleStatus === "completed" || course.lifecycleStatus === "cancelled") {
    return NextResponse.json({ error: "Bu kursda o‘qituvchini almashtirib bo‘lmaydi" }, { status: 409 });
  }
  const next = await prisma.teacher.findFirst({
    where: { id: parsed.data.teacherId, subjectId: course.subjectId, userId: { not: null } },
  });
  if (!next || next.id === course.teacherId) {
    return NextResponse.json({ error: "Shu fan bo‘yicha mos o‘qituvchi topilmadi" }, { status: 409 });
  }

  const others = await loadTeacherLessonWindows(next.id);
  for (const lesson of course.lessons) {
    if (!["scheduled", "lobby", "waiting_room", "live", "paused"].includes(lesson.status)) continue;
    const hit = findScheduleConflict(
      { start: lesson.scheduledAt, end: lessonEnd(lesson), excludeId: lesson.id },
      others.map((o) => ({ ...o, status: "scheduled" })),
    );
    if (hit) {
      return NextResponse.json(
        { error: `${next.fullName} band: ${hit.courseTitleUz} — ${hit.titleUz}`, code: "CONFLICT" },
        { status: 409 },
      );
    }
  }

  const updated = await prisma.course.updateMany({
    where: { id: course.id, teacherId: course.teacherId },
    data: { teacherId: next.id },
  });
  if (updated.count !== 1) {
    return NextResponse.json({ error: "Kurs holati o‘zgardi — sahifani yangilang" }, { status: 409 });
  }
  await writeAuditLog({
    actorId: session.user.id,
    action: "course.replace_teacher",
    entityType: "Course",
    entityId: course.id,
    metadata: { from: course.teacherId, to: next.id },
  });
  await notifyCourseStudents(course.id, {
    type: "teacher_changed",
    titleUz: "O‘qituvchi almashtirildi",
    messageUz: `«${course.titleUz}»: ${course.teacher.fullName} o‘rniga ${next.fullName}.`,
    relatedId: course.id,
  }).catch(() => undefined);
  return NextResponse.json({ ok: true, teacherId: next.id, teacherName: next.fullName });
}
