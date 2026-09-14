import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { requireStudentCabinet, getActiveSubscriptions } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { canWatchLive } from "@/lib/tariffs";
import { formatDateTime } from "@/lib/utils";
import { clockLabel, dayTitle, lessonCover, statusLabel } from "@/lib/plan";

export const dynamic = "force-dynamic";

export default async function StudentAppPage() {
  const { user } = await requireStudentCabinet("/app");
  const subs = await getActiveSubscriptions(user.id);
  const courseIds = subs.map((s) => s.course.id);
  const tierByCourse = new Map(subs.map((s) => [s.course.id, s.tier]));
  const now = new Date();
  const week = new Date(now);
  week.setDate(week.getDate() + 7);

  const [live, upcoming, due, lastSeen] = await Promise.all([
    prisma.lesson.findMany({
      where: { courseId: { in: courseIds }, status: "live" },
      include: { course: { include: { teacher: { select: { fullName: true } } } } },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.lesson.findMany({
      where: { courseId: { in: courseIds }, status: "scheduled", scheduledAt: { gte: now, lte: week } },
      include: { course: { include: { teacher: { select: { fullName: true } } } } },
      orderBy: { scheduledAt: "asc" },
      take: 4,
    }),
    prisma.assignment.findMany({
      where: {
        courseId: { in: courseIds },
        dueAt: { gte: now },
        submissions: { none: { userId: user.id } },
      },
      include: { course: { include: { teacher: { select: { fullName: true } } } } },
      orderBy: { dueAt: "asc" },
      take: 4,
    }),
    prisma.attendance.findFirst({
      where: { userId: user.id, lesson: { courseId: { in: courseIds } } },
      orderBy: { joinedAt: "desc" },
      include: { lesson: { include: { course: { include: { teacher: { select: { fullName: true } } } } } } },
    }),
  ]);

  const teachers = new Set(subs.map((s) => s.course.teacher.id)).size;

  return (
    <AppShell active="home">
      <div className="lx-board">
        <p className="lx-kicker">Bugun</p>
        <h2>Nima qilish kerak</h2>
        <p className="muted small lx-lead">
          {subs.length} ta kurs · {teachers} ta o&apos;qituvchi. Bu yer bitta kurs lentasi emas.
        </p>

        {live.length === 0 && upcoming.length === 0 && due.length === 0 && !lastSeen ? (
          <div className="empty">Hali reja yo&apos;q. Kurslarimdan o&apos;qituvchingizni oching.</div>
        ) : null}

        {live.length > 0 ? (
          <section className="lx-section">
            <h3>Hozir jonli</h3>
            <div className="lx-stack">
              {live.map((lesson) => (
                <Link key={lesson.id} href={`/learn/${lesson.id}`} className="lx-row">
                  <div>
                    <p className="lx-kicker">{lesson.course.teacher.fullName}</p>
                    <h3>{lesson.titleUz}</h3>
                    <p className="small muted" style={{ margin: 0 }}>{lesson.course.titleUz}</p>
                    <span className="badge danger" style={{ marginTop: 8, display: "inline-block" }}>
                      {canWatchLive(tierByCourse.get(lesson.courseId) ?? "t1") ? "Jonli" : "1-tarifda yozuvdan keyin"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {lastSeen ? (
          <section className="lx-section">
            <h3>Davom ettirish</h3>
            <Link href={`/learn/${lastSeen.lesson.id}`} className="lx-row">
              {lessonCover(lastSeen.lesson.coverUrl, lastSeen.lesson.muxVodPlaybackId || lastSeen.lesson.muxLivePlaybackId) ? (
                <img
                  className="lx-cover"
                  alt=""
                  src={lessonCover(lastSeen.lesson.coverUrl, lastSeen.lesson.muxVodPlaybackId || lastSeen.lesson.muxLivePlaybackId) ?? ""}
                />
              ) : null}
              <div>
                <p className="lx-kicker">{lastSeen.lesson.course.teacher.fullName}</p>
                <h3>{lastSeen.lesson.titleUz}</h3>
                <p className="small muted" style={{ margin: 0 }}>{lastSeen.lesson.course.titleUz}</p>
              </div>
            </Link>
          </section>
        ) : null}

        {due.length > 0 ? (
          <section className="lx-section">
            <h3>Muddati yaqin topshiriq</h3>
            <div className="lx-stack">
              {due.map((item) => (
                <Link key={item.id} href="/assignments" className="lx-row">
                  <div>
                    <p className="lx-kicker">{item.course.teacher.fullName} · {formatDateTime(item.dueAt)}</p>
                    <h3>{item.titleUz}</h3>
                    <p className="small muted" style={{ margin: 0 }}>{item.course.titleUz}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {upcoming.length > 0 ? (
          <section className="lx-section">
            <h3>Shu hafta reja</h3>
            <div className="lx-stack">
              {upcoming.map((lesson) => (
                <Link key={lesson.id} href={`/learn/${lesson.id}`} className="lx-row">
                  <div>
                    <p className="lx-kicker">
                      {dayTitle(lesson.scheduledAt)} · {clockLabel(lesson.scheduledAt)} · {lesson.course.teacher.fullName}
                    </p>
                    <h3>{lesson.titleUz}</h3>
                    <p className="small muted" style={{ margin: 0 }}>
                      {lesson.course.titleUz} · {statusLabel(lesson.status)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
            <p style={{ marginTop: 12 }}>
              <Link href="/schedule" className="btn btn-sm">To&apos;liq dars reja</Link>
            </p>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
