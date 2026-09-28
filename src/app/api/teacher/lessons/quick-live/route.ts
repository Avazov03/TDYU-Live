import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTeacherForUser } from "@/lib/teacher";
import { ensureTeacherWorkspace } from "@/lib/teacher-workspace";
import { isCourseReviewV1Enabled } from "@/lib/feature-flags";

const QUICK_TITLE = "Jonli dars";
const QUICK_REUSE_MS = 30 * 60 * 1000;

export async function POST() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }
  const teacher = await getTeacherForUser(session.user.id);
  if (!teacher) return NextResponse.json({ error: "Profil yo'q" }, { status: 404 });

  let courseId: string | null;
  if (isCourseReviewV1Enabled()) {
    await ensureTeacherWorkspace(teacher.id);
    const liveCourse = await prisma.course.findFirst({
      where: {
        teacherId: teacher.id,
        OR: [
          { lifecycleStatus: null },
          { lifecycleStatus: { in: ["published", "upcoming", "active"] } },
        ],
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!liveCourse) {
      return NextResponse.json(
        { error: "Nashr etilgan kurs yo‘q — avval kursni tekshiruvga yuboring" },
        { status: 409 },
      );
    }
    courseId = liveCourse.id;
  } else {
    courseId = await ensureTeacherWorkspace(teacher.id);
  }
  if (!courseId) return NextResponse.json({ error: "Kurs ochilmadi" }, { status: 500 });

  const live = await prisma.lesson.findFirst({
    where: { status: "live", course: { teacherId: teacher.id } },
  });
  if (live) return NextResponse.json({ lesson: live, alreadyLive: true });

  // Double click / second tab: reuse the quick lesson that has not started yet.
  // The per-teacher advisory lock makes parallel clicks see each other's insert.
  const targetCourseId = courseId;
  const { lesson, reused } = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`select pg_advisory_xact_lock(hashtext(${`quick-live:${teacher.id}`}))`;
    const pending = await tx.lesson.findFirst({
      where: {
        courseId: targetCourseId,
        titleUz: QUICK_TITLE,
        status: { in: ["scheduled", "lobby", "waiting_room"] },
        createdAt: { gte: new Date(Date.now() - QUICK_REUSE_MS) },
      },
      orderBy: { createdAt: "desc" },
    });
    if (pending) return { lesson: pending, reused: true };
    const created = await tx.lesson.create({
      data: { courseId: targetCourseId, titleUz: QUICK_TITLE, scheduledAt: new Date() },
    });
    return { lesson: created, reused: false };
  });
  return reused ? NextResponse.json({ lesson, reused: true }) : NextResponse.json({ lesson }, { status: 201 });
}
