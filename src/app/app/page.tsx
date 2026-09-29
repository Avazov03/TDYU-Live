import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Icon } from "@/components/ui/Icon";
import { AddToCalendar } from "@/components/lesson/AddToCalendar";
import { requireStudentCabinet, getStudentOwnedCourses } from "@/lib/access";
import { getEnrollmentAccessMode, shouldHideStudentTariffUi } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";
import { canWatchLive } from "@/lib/tariffs";
import { UZ_MONTHS_LONG, UZ_MONTHS_SHORT, formatDateTime, tashkentParts } from "@/lib/utils";
import { clockLabel, dayTitle, localDayKey, weekdayUz } from "@/lib/plan";
import { DEFAULT_LESSON_MINUTES, lessonEnd, overlappingLessons } from "@/lib/schedule-policy";
import type { LessonStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const DONE_STATUSES: LessonStatus[] = [
  "ended",
  "recording_processing",
  "recording_ready",
  "teacher_review",
  "published",
];
const JOIN_SOON_MS = 15 * 60_000;

function todayLabel(now: Date) {
  const p = tashkentParts(now);
  return `${weekdayUz(now)}, ${Number(p.day)}-${UZ_MONTHS_LONG[p.monthIndex]}`;
}

function daysUntil(now: Date, at: Date) {
  const days = Math.round((Date.parse(localDayKey(at)) - Date.parse(localDayKey(now))) / 86_400_000);
  // Today / tomorrow are already spelled out by dayTitle().
  if (days <= 1) return null;
  return `${days} kundan keyin`;
}

export default async function StudentAppPage() {
  const { user } = await requireStudentCabinet("/app");
  const owned = await getStudentOwnedCourses(user.id);
  const courseIds = owned.map((o) => o.courseId);
  const tierByCourse = new Map(owned.map((o) => [o.courseId, o.tier]));
  const enrollmentLiveOpen = getEnrollmentAccessMode() === "enrollment";
  const hideTariff = shouldHideStudentTariffUi();
  const now = new Date();
  // A late teacher has not opened the lesson yet — keep it listed until its slot is over.
  const slotStartedSince = new Date(now.getTime() - DEFAULT_LESSON_MINUTES * 60_000);
  const courseInclude = { course: { include: { teacher: { select: { fullName: true } } } } };
  const activeCourseIds = owned
    .filter((o) => o.status !== "completed" && o.course.lifecycleStatus !== "completed")
    .map((o) => o.courseId);

  const [live, upcoming, due, dueCount, lastSeen, lessonStats] = await Promise.all([
    prisma.lesson.findMany({
      where: { courseId: { in: courseIds }, status: { in: ["live", "lobby", "waiting_room"] } },
      include: courseInclude,
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.lesson.findMany({
      where: {
        courseId: { in: courseIds },
        status: "scheduled",
        scheduledAt: { gte: slotStartedSince },
      },
      include: courseInclude,
      orderBy: { scheduledAt: "asc" },
      take: 6,
    }),
    prisma.assignment.findMany({
      where: {
        courseId: { in: courseIds },
        dueAt: { gte: now },
        submissions: { none: { userId: user.id } },
      },
      include: courseInclude,
      orderBy: { dueAt: "asc" },
      take: 3,
    }),
    prisma.assignment.count({
      where: {
        courseId: { in: courseIds },
        dueAt: { gte: now },
        submissions: { none: { userId: user.id } },
      },
    }),
    prisma.attendance.findFirst({
      where: { userId: user.id, lesson: { courseId: { in: courseIds } } },
      orderBy: { joinedAt: "desc" },
      include: { lesson: { include: courseInclude } },
    }),
    prisma.lesson.groupBy({
      by: ["status"],
      where: { courseId: { in: courseIds }, status: { not: "cancelled" } },
      _count: { _all: true },
    }),
  ]);

  const teachers = new Set(owned.map((o) => o.course.teacher.id)).size;
  const lessonsTotal = lessonStats.reduce((a, s) => a + s._count._all, 0);
  const lessonsDone = lessonStats
    .filter((s) => DONE_STATUSES.includes(s.status))
    .reduce((a, s) => a + s._count._all, 0);
  const firstName = user.name?.trim().split(/\s+/)[0];

  const focusLive = live[0] ?? null;
  const focusNext = focusLive ? null : (upcoming[0] ?? null);
  const listLessons = [...live.slice(1), ...upcoming.slice(focusNext ? 1 : 0)].slice(0, 5);
  const nextStartsSoon = Boolean(
    focusNext && focusNext.scheduledAt.getTime() - now.getTime() <= JOIN_SOON_MS,
  );
  // Nothing has happened yet — a row of zeros tells a new student nothing.
  const showStats = lessonsDone > 0 || dueCount > 0;
  const showSide = due.length > 0 || Boolean(lastSeen);
  const showLessons = Boolean(focusLive || focusNext);
  const multiCourse = courseIds.length > 1;
  const completedCount = owned.length - activeCourseIds.length;
  const allCompleted = owned.length > 0 && activeCourseIds.length === 0;
  const clashes = overlappingLessons(
    [...live, ...upcoming].map((l) => ({ id: l.id, title: l.titleUz, start: l.scheduledAt, end: lessonEnd(l) })),
  );
  const dayGroups: { label: string; items: typeof listLessons }[] = [];
  for (const lesson of listLessons) {
    const title = dayTitle(lesson.scheduledAt);
    const label = title === "Bugun" || title === "Ertaga" ? title : "Keyinroq";
    const group = dayGroups.find((g) => g.label === label);
    if (group) group.items.push(lesson);
    else dayGroups.push({ label, items: [lesson] });
  }
  const siteBase = (process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");

  return (
    <AppShell active="home">
      <div className="lx-today">
        <header className="lx-today-head">
          <p className="lx-kicker">{todayLabel(now)}</p>
          <h1 className="lx-today-title">{firstName ? `Salom, ${firstName}!` : "Salom!"}</h1>
          <p className="lx-today-sub">
            {owned.length} ta kurs · {teachers} ta o&apos;qituvchi
          </p>
        </header>

        {owned.length === 0 ? (
          <div className="lx-mc-empty">
            <h2>Hali kursingiz yo‘q</h2>
            <p>Kurs sotib oling — darslar va jadval shu yerda chiqadi.</p>
            <Link href={hideTariff ? "/#kurslar" : "/#tariflar"} className="btn btn-primary">
              Kurslarni ko‘rish
            </Link>
          </div>
        ) : (
          <>
            {focusLive ? (
              <section className="lx-mc-next is-live lx-today-focus" aria-label="Jonli dars">
                <div className="lx-mc-next-info">
                  <span className="lx-mc-next-label">
                    {focusLive.status === "live" ? "Hozir efirda" : "Kutish xonasi ochiq"}
                  </span>
                  <p className="lx-mc-next-title">{focusLive.titleUz}</p>
                  <p className="lx-mc-next-meta">
                    {focusLive.course.titleUz} · {focusLive.course.teacher.fullName}
                  </p>
                  {focusLive.status === "live" &&
                  !enrollmentLiveOpen &&
                  !canWatchLive(tierByCourse.get(focusLive.courseId) ?? "t1") ? (
                    <p className="lx-mc-next-meta">Sizning tarifingizda dars yozuvdan keyin ochiladi.</p>
                  ) : null}
                </div>
                <Link href={`/learn/${focusLive.id}`} className="btn btn-primary lx-mc-next-cta">
                  Darsga kirish
                </Link>
              </section>
            ) : focusNext ? (
              <section className="lx-mc-next lx-today-focus" aria-label="Keyingi dars">
                <div className="lx-mc-next-info">
                  <span className="lx-mc-next-label">Keyingi dars</span>
                  <p className="lx-mc-next-title">{focusNext.titleUz}</p>
                  <p className="lx-mc-next-meta">
                    {focusNext.course.titleUz} ·{" "}
                    <strong>
                      {dayTitle(focusNext.scheduledAt)} · {clockLabel(focusNext.scheduledAt)}
                    </strong>
                    {daysUntil(now, focusNext.scheduledAt)
                      ? ` · ${daysUntil(now, focusNext.scheduledAt)}`
                      : ""}
                  </p>
                  {clashes.has(focusNext.id) ? (
                    <p className="lx-mc-next-meta lx-clash-note" data-testid="lesson-clash">
                      Vaqti «{clashes.get(focusNext.id)!.join("», «")}» darsi bilan ustma-ust
                    </p>
                  ) : null}
                </div>
                <div className="lx-today-focus-actions">
                  {nextStartsSoon ? null : (
                    <AddToCalendar
                      className="btn lx-mc-next-cta lx-today-cal"
                      lessonId={focusNext.id}
                      title={focusNext.titleUz}
                      courseTitle={focusNext.course.titleUz}
                      startsAtIso={focusNext.scheduledAt.toISOString()}
                      endsAtIso={(
                        focusNext.scheduledEndAt ??
                        new Date(
                          focusNext.scheduledAt.getTime() +
                            (focusNext.durationMinutes ?? DEFAULT_LESSON_MINUTES) * 60_000,
                        )
                      ).toISOString()}
                      lessonUrl={`${siteBase}/learn/${focusNext.id}`}
                      fileName="lexify-dars.ics"
                    />
                  )}
                  <Link href={`/learn/${focusNext.id}`} className="btn btn-primary lx-mc-next-cta">
                    {nextStartsSoon ? "Darsga kirish" : "Dars sahifasi"}
                  </Link>
                </div>
              </section>
            ) : allCompleted ? (
              <section className="lx-mc-next lx-today-focus" aria-label="Kurslar yakunlandi">
                <div className="lx-mc-next-info">
                  <span className="lx-mc-next-label">
                    {completedCount > 1 ? "Kurslaringiz yakunlandi" : "Kursingiz yakunlandi"}
                  </span>
                  <p className="lx-mc-next-title">Yozuvlar doimiy ochiq</p>
                  <p className="lx-mc-next-meta">Istalgan darsni qayta ko‘rishingiz yoki yangi kurs tanlashingiz mumkin.</p>
                </div>
                <div className="lx-today-focus-actions">
                  <Link href={hideTariff ? "/#kurslar" : "/#tariflar"} className="btn lx-mc-next-cta">
                    Yangi kurs topish
                  </Link>
                  <Link href="/my-courses" className="btn btn-primary lx-mc-next-cta">
                    Yozuvlarni ko‘rish
                  </Link>
                </div>
              </section>
            ) : (
              <section className="lx-mc-next lx-today-focus" aria-label="Keyingi dars">
                <div className="lx-mc-next-info">
                  <span className="lx-mc-next-label">Keyingi dars</span>
                  <p className="lx-mc-next-title">Rejada dars yo‘q</p>
                  <p className="lx-mc-next-meta">
                    O‘qituvchi yangi dars qo‘shsa, shu yerda chiqadi.
                  </p>
                </div>
                <Link href="/my-courses" className="btn lx-mc-next-cta">
                  Kurslarim
                </Link>
              </section>
            )}

            {showStats ? (
            <div className="lx-today-stats">
              <Link href="/my-courses" className="lx-today-stat">
                <span className="lx-today-stat-icon">
                  <Icon name="book" size={18} />
                </span>
                <span className="lx-today-stat-num">{allCompleted ? completedCount : activeCourseIds.length}</span>
                <span className="lx-today-stat-label">{allCompleted ? "Yakunlangan kurs" : "Faol kurs"}</span>
              </Link>
              <Link href="/schedule" className="lx-today-stat">
                <span className="lx-today-stat-icon">
                  <Icon name="video" size={18} />
                </span>
                <span className="lx-today-stat-num">
                  {lessonsDone}
                  <small> / {lessonsTotal}</small>
                </span>
                <span className="lx-today-stat-label">Dars o‘tildi</span>
              </Link>
              <Link href="/assignments" className="lx-today-stat">
                <span className="lx-today-stat-icon">
                  <Icon name="file" size={18} />
                </span>
                <span className="lx-today-stat-num">{dueCount}</span>
                <span className="lx-today-stat-label">Topshiriq kutilmoqda</span>
              </Link>
            </div>
            ) : null}

            {showLessons || showSide ? (
            <div className={showLessons && showSide ? "lx-today-grid" : "lx-today-grid is-single"}>
              {showLessons ? (
              <section className="lx-today-block">
                <div className="lx-cd-blockhead">
                  <h2 className="lx-cd-h2">Yaqin darslar</h2>
                  <Link href="/schedule" className="lx-today-more">
                    To‘liq jadval →
                  </Link>
                </div>
                {listLessons.length === 0 ? (
                  <p className="lx-today-empty">Boshqa rejalashtirilgan dars yo‘q.</p>
                ) : (
                  dayGroups.map((group) => (
                    <div key={group.label} className="lx-today-daygroup">
                      <h3 className="lx-today-daylabel">{group.label}</h3>
                      <ol className="lx-cd-lessons">
                        {group.items.map((lesson) => {
                          const p = tashkentParts(lesson.scheduledAt);
                          const isLive = lesson.status !== "scheduled";
                          const clash = clashes.get(lesson.id);
                          return (
                            <li key={lesson.id}>
                              <Link href={`/learn/${lesson.id}`} className="lx-cd-lesson is-link lx-today-lesson">
                                <span className="lx-cd-date">
                                  <strong>{Number(p.day)}</strong>
                                  <span>{UZ_MONTHS_SHORT[p.monthIndex]}</span>
                                </span>
                                <span className="lx-cd-linfo">
                                  <span className="lx-cd-ltitle">{lesson.titleUz}</span>
                                  <span className="lx-cd-lsub">
                                    {group.label === "Keyinroq" ? `${weekdayUz(lesson.scheduledAt)} · ` : ""}
                                    {clockLabel(lesson.scheduledAt)}
                                    {multiCourse ? ` · ${lesson.course.titleUz}` : ""}
                                  </span>
                                </span>
                                <span className="lx-cd-lend">
                                  {isLive ? <span className="lx-cd-pill is-live">Jonli</span> : null}
                                  {clash ? (
                                    <span
                                      className="lx-cd-pill is-clash"
                                      title={`«${clash.join("», «")}» bilan bir vaqtda`}
                                      data-testid="lesson-clash"
                                    >
                                      Vaqti ustma-ust
                                    </span>
                                  ) : null}
                                  <span className="lx-cd-open" aria-hidden>
                                    →
                                  </span>
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  ))
                )}
              </section>
              ) : null}

              {showSide ? (
              <div className="lx-today-side">
                {due.length > 0 ? (
                <section className="lx-today-block">
                  <div className="lx-cd-blockhead">
                    <h2 className="lx-cd-h2">Topshiriqlar</h2>
                    {dueCount > 0 ? (
                      <Link href="/assignments" className="lx-today-more">
                        Barchasi →
                      </Link>
                    ) : null}
                  </div>
                  <div className="lx-today-cards">
                    {due.map((item) => (
                      <Link key={item.id} href="/assignments" className="lx-today-card">
                        <span className="lx-today-card-title">{item.titleUz}</span>
                        <span className="lx-today-card-sub">{item.course.titleUz}</span>
                        <span className="lx-today-card-due">
                          <Icon name="clock" size={14} /> {formatDateTime(item.dueAt)} gacha
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
                ) : null}

                {lastSeen ? (
                  <section className="lx-today-block">
                    <h2 className="lx-cd-h2">Davom ettirish</h2>
                    <Link href={`/learn/${lastSeen.lesson.id}`} className="lx-today-card">
                      <span className="lx-today-card-title">{lastSeen.lesson.titleUz}</span>
                      <span className="lx-today-card-sub">{lastSeen.lesson.course.titleUz}</span>
                      <span className="lx-today-card-due">
                        <Icon name="play" size={14} /> Darsni ochish
                      </span>
                    </Link>
                  </section>
                ) : null}
              </div>
              ) : null}
            </div>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
