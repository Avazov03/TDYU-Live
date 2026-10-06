/**
 * Local QA: read-only snapshot of fixture state + DB invariants. Refuses non-local databases.
 */
import { config } from "dotenv";
import { createSeedClient } from "../src/lib/prisma";

config({ path: ".env" });

const raw = process.env.DATABASE_URL || "";
const host = new URL(raw.replace(/^postgresql:/i, "http:").replace(/^postgres:/i, "http:")).hostname;
if (host !== "localhost" && host !== "127.0.0.1") {
  console.error("refused: not local");
  process.exit(1);
}

async function main() {
  const prisma = createSeedClient();
  const courses = await prisma.course.findMany({
    where: { OR: [{ id: { startsWith: "a444" } }, { id: { startsWith: "c777" } }] },
    select: {
      id: true,
      titleUz: true,
      lifecycleStatus: true,
      isPublished: true,
      listPrice: true,
      teacher: { select: { fullName: true } },
      lessons: { select: { titleUz: true, status: true }, orderBy: { scheduledAt: "asc" } },
    },
  });
  const purchases = await prisma.purchase.findMany({
    select: {
      id: true,
      status: true,
      amountPaid: true,
      user: { select: { email: true } },
      course: { select: { titleUz: true } },
      payments: { select: { id: true, status: true } },
      refunds: { select: { type: true, amount: true, status: true } },
    },
  });
  const enrollments = await prisma.enrollment.findMany({
    select: { status: true, accessOpen: true, user: { select: { email: true } }, course: { select: { titleUz: true } } },
  });

  const q = (sql: string) => prisma.$queryRawUnsafe<{ n: bigint }[]>(sql).then((r) => Number(r[0]?.n ?? 0));
  const invariants = {
    duplicateOpenEnrollment: await q(
      `SELECT COUNT(*) n FROM (SELECT user_id, course_id FROM enrollments WHERE access_open GROUP BY 1,2 HAVING COUNT(*)>1) t`,
    ),
    duplicateActiveLiveSession: await q(
      `SELECT COUNT(*) n FROM (SELECT lesson_id FROM live_sessions WHERE status IN ('created','waiting','live','paused') GROUP BY 1 HAVING COUNT(*)>1) t`,
    ),
    openAttendanceOnEndedSession: await q(
      `SELECT COUNT(*) n FROM attendance_intervals a JOIN live_sessions s ON s.id=a.live_session_id WHERE a.left_at IS NULL AND s.status IN ('ended','abandoned')`,
    ),
    openAttendanceTotal: await q(`SELECT COUNT(*) n FROM attendance_intervals WHERE left_at IS NULL`),
    publishedRecordingOnUnfinishedLesson: await q(
      `SELECT COUNT(*) n FROM recordings r JOIN lessons l ON l.id=r.lesson_id WHERE r.status='published' AND l.status IN ('scheduled','lobby','waiting_room','live','paused','cancelled')`,
    ),
    duplicateActiveRecordingPerLesson: await q(
      `SELECT COUNT(*) n FROM (SELECT lesson_id FROM recordings WHERE status IN ('not_started','processing','ready','teacher_review','published') GROUP BY 1 HAVING COUNT(*)>1) t`,
    ),
    livePlaybackIdUsedAsReplay: await q(
      `SELECT COUNT(*) n FROM recordings r JOIN lessons l ON l.id=r.lesson_id WHERE r.mux_playback_id IS NOT NULL AND (r.mux_playback_id = l.mux_live_playback_id OR l.mux_vod_playback_id = l.mux_live_playback_id)`,
    ),
    orphanCourseTeacher: await q(`SELECT COUNT(*) n FROM courses c LEFT JOIN teachers t ON t.id=c.teacher_id WHERE t.id IS NULL`),
    openSeatOnRefundedPurchase: await q(
      `SELECT COUNT(*) n FROM enrollments e JOIN purchases p ON p.id=e.purchase_id WHERE e.access_open AND p.status IN ('refunded','partially_refunded')`,
    ),
    duplicateRefundPerPurchase: await q(
      `SELECT COUNT(*) n FROM (SELECT purchase_id FROM refunds WHERE status='refunded' GROUP BY 1 HAVING COUNT(*)>1) t`,
    ),
    completedCourseWithOpenLessons: await q(
      `SELECT COUNT(*) n FROM courses c JOIN lessons l ON l.course_id=c.id WHERE c.lifecycle_status='completed' AND l.status IN ('scheduled','lobby','waiting_room','live','paused')`,
    ),
  };

  console.log(JSON.stringify({ courses, purchases, enrollments, invariants }, null, 2));
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : "failed");
  process.exit(1);
});
