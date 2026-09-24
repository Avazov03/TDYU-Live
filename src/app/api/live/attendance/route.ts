import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isLiveAttendanceV3Enabled } from "@/lib/feature-flags";
import { attendanceDurationSeconds } from "@/lib/live-attendance";
import { findActiveLiveSession } from "@/lib/live-session";
import { isAdminRole, isTeacherRole } from "@/lib/roles";

const querySchema = z.object({
  lessonId: z.string().trim().min(1),
  liveSessionId: z.string().trim().min(1).optional(),
});

/**
 * GET /api/live/attendance?lessonId=
 * Student: own intervals. Teacher/admin of course: all intervals for session.
 */
export async function GET(req: Request) {
  if (!isLiveAttendanceV3Enabled()) {
    return NextResponse.json({ error: "Attendance o‘chiq", code: "FLAG_OFF" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Kirish kerak" }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    lessonId: url.searchParams.get("lessonId") ?? "",
    liveSessionId: url.searchParams.get("liveSessionId") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Noto'g'ri ma'lumot" }, { status: 400 });
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: parsed.data.lessonId },
    include: { course: { include: { teacher: true } } },
  });
  if (!lesson) {
    return NextResponse.json({ error: "Dars topilmadi" }, { status: 404 });
  }

  const isModerator =
    isAdminRole(session.user.role) ||
    (isTeacherRole(session.user.role) && lesson.course.teacher.userId === session.user.id);

  let liveSessionId = parsed.data.liveSessionId;
  if (!liveSessionId) {
    const active = await findActiveLiveSession(lesson.id);
    if (active) liveSessionId = active.id;
    else {
      const last = await prisma.liveSession.findFirst({
        where: { lessonId: lesson.id },
        orderBy: { createdAt: "desc" },
      });
      liveSessionId = last?.id;
    }
  }
  if (!liveSessionId) {
    return NextResponse.json({ ok: true, liveSessionId: null, intervals: [] });
  }

  const now = new Date();
  const rows = await prisma.attendanceInterval.findMany({
    where: isModerator
      ? { liveSessionId }
      : { liveSessionId, userId: session.user.id },
    include: isModerator
      ? { user: { select: { id: true, fullName: true, email: true } } }
      : undefined,
    orderBy: [{ userId: "asc" }, { joinedAt: "asc" }],
  });

  return NextResponse.json({
    ok: true,
    liveSessionId,
    intervals: rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      lessonId: row.lessonId,
      liveSessionId: row.liveSessionId,
      joinedAt: row.joinedAt.toISOString(),
      leftAt: row.leftAt?.toISOString() ?? null,
      open: row.leftAt == null,
      durationSeconds: attendanceDurationSeconds({
        joinedAt: row.joinedAt,
        leftAt: row.leftAt,
        now,
      }),
      source: row.source,
      userName:
        isModerator && "user" in row
          ? (row as { user?: { fullName: string | null } }).user?.fullName ?? null
          : undefined,
    })),
  });
}
