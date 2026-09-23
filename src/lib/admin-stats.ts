import { prisma } from "@/lib/prisma";
import { isSubscriptionActive } from "@/lib/tariffs";

const TZ = "Asia/Tashkent";

function dayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dayLabel(date: Date) {
  return new Intl.DateTimeFormat("uz-UZ", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
  }).format(date);
}

function startOfDayTashkent(daysAgo: number) {
  const now = new Date();
  const key = dayKey(new Date(now.getTime() - daysAgo * 86_400_000));
  // Interpret YYYY-MM-DD as midnight UTC+5 approx for range queries
  return new Date(`${key}T00:00:00+05:00`);
}

export async function getAdminDashboard() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekAhead = new Date(now);
  weekAhead.setDate(weekAhead.getDate() + 7);
  const days30 = startOfDayTashkent(29);
  const expireSoon = new Date(now);
  expireSoon.setDate(expireSoon.getDate() + 7);

  const [
    studentCount,
    teacherCount,
    invitePending,
    teacherBlocked,
    courseCount,
    activeSubs,
    liveLessons,
    monthPayments,
    recentStudents,
    recentPayments,
    weekLessons,
    expiringSubs,
    openInvites,
    liveNow,
    topCoursesRaw,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "student" } }),
    prisma.teacher.count(),
    prisma.teacher.count({ where: { userId: null } }),
    prisma.user.count({ where: { role: "teacher", isBlocked: true } }),
    prisma.course.count(),
    prisma.subscription.findMany({
      where: { endsAt: { gt: now } },
      select: { tier: true, endsAt: true },
    }),
    prisma.lesson.count({ where: { status: "live" } }),
    prisma.payment.findMany({
      where: {
        createdAt: { gte: monthStart },
        status: { in: ["demo_paid", "paid"] },
      },
      select: { amount: true },
    }),
    prisma.user.findMany({
      where: { role: "student", createdAt: { gte: days30 } },
      select: { createdAt: true },
    }),
    prisma.payment.findMany({
      where: {
        createdAt: { gte: days30 },
        status: { in: ["demo_paid", "paid"] },
      },
      select: { amount: true, createdAt: true },
    }),
    prisma.lesson.findMany({
      where: {
        scheduledAt: {
          gte: new Date(now.getTime() - 7 * 86_400_000),
          lte: weekAhead,
        },
      },
      select: { status: true },
    }),
    prisma.subscription.findMany({
      where: { endsAt: { gt: now, lte: expireSoon } },
      include: {
        user: { select: { fullName: true } },
        course: { select: { titleUz: true, teacher: { select: { fullName: true } } } },
      },
      orderBy: { endsAt: "asc" },
      take: 6,
    }),
    prisma.teacherInvite.findMany({
      where: { usedAt: null, expiresAt: { gt: now } },
      include: { teacher: { select: { fullName: true } } },
      orderBy: { expiresAt: "asc" },
      take: 5,
    }),
    prisma.lesson.findMany({
      where: { status: "live" },
      include: {
        course: {
          select: {
            titleUz: true,
            teacher: { select: { fullName: true } },
          },
        },
      },
      orderBy: { scheduledAt: "asc" },
      take: 5,
    }),
    prisma.course.findMany({
      select: {
        id: true,
        titleUz: true,
        teacher: { select: { fullName: true } },
        subscriptions: { select: { endsAt: true } },
      },
      take: 40,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const activeTier = { t1: 0, t2: 0, t3: 0 };
  for (const sub of activeSubs) {
    if (isSubscriptionActive(sub.endsAt)) activeTier[sub.tier] += 1;
  }

  const registrationsByDay = buildDaySeries(29, recentStudents.map((u) => u.createdAt));
  const revenueByDay = buildDaySeriesSum(29, recentPayments.map((p) => ({ at: p.createdAt, amount: p.amount })));

  const lessonStatus: Record<string, number> = {
    live: 0,
    lobby: 0,
    scheduled: 0,
    ended: 0,
  };
  for (const lesson of weekLessons) {
    lessonStatus[lesson.status] = (lessonStatus[lesson.status] ?? 0) + 1;
  }

  const topCourses = topCoursesRaw
    .map((course) => ({
      id: course.id,
      title: course.titleUz,
      teacher: course.teacher.fullName,
      activeStudents: course.subscriptions.filter((s) => isSubscriptionActive(s.endsAt)).length,
    }))
    .filter((c) => c.activeStudents > 0)
    .sort((a, b) => b.activeStudents - a.activeStudents)
    .slice(0, 5);

  const monthRevenue = monthPayments.reduce((n, p) => n + p.amount, 0);

  return {
    kpis: {
      students: studentCount,
      teachers: teacherCount,
      teachersPending: invitePending,
      teachersBlocked: teacherBlocked,
      courses: courseCount,
      activeSubs: activeSubs.length,
      live: liveLessons,
      monthRevenue,
    },
    tiers: activeTier,
    registrationsByDay,
    revenueByDay,
    lessonStatus,
    topCourses,
    attention: {
      live: liveNow.map((l) => ({
        id: l.id,
        title: l.titleUz,
        course: l.course.titleUz,
        teacher: l.course.teacher.fullName,
      })),
      invites: openInvites.map((i) => ({
        id: i.id,
        teacher: i.teacher.fullName,
        expiresAt: i.expiresAt.toISOString(),
      })),
      expiring: expiringSubs.map((s) => ({
        id: s.id,
        student: s.user.fullName,
        course: s.course.titleUz,
        teacher: s.course.teacher.fullName,
        endsAt: s.endsAt.toISOString(),
      })),
    },
  };
}

function buildDaySeries(daysBack: number, dates: Date[]) {
  const buckets = new Map<string, { label: string; value: number; sort: number }>();
  for (let i = daysBack; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 86_400_000);
    const key = dayKey(d);
    buckets.set(key, { label: dayLabel(d), value: 0, sort: i });
  }
  for (const date of dates) {
    const key = dayKey(date);
    const row = buckets.get(key);
    if (row) row.value += 1;
  }
  return [...buckets.values()].map(({ label, value }) => ({ label, value }));
}

function buildDaySeriesSum(daysBack: number, rows: { at: Date; amount: number }[]) {
  const buckets = new Map<string, { label: string; value: number }>();
  for (let i = daysBack; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 86_400_000);
    const key = dayKey(d);
    buckets.set(key, { label: dayLabel(d), value: 0 });
  }
  for (const row of rows) {
    const key = dayKey(row.at);
    const bucket = buckets.get(key);
    if (bucket) bucket.value += row.amount;
  }
  return [...buckets.values()];
}
