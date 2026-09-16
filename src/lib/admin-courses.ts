import { prisma } from "@/lib/prisma";
import { isSubscriptionActive } from "@/lib/tariffs";

export type CourseHealth = "empty" | "idle" | "on_track" | "live" | "stale";

export type AdminCourseInsight = {
  id: string;
  titleUz: string;
  descriptionUz: string;
  teacherId: string;
  teacherName: string;
  facultyId: string;
  facultyName: string;
  subjectId: string;
  subjectName: string;
  priceT1: number;
  priceT2: number;
  priceT3: number;
  isPublished: boolean;
  lessonCount: number;
  scheduledCount: number;
  liveCount: number;
  endedCount: number;
  activeStudents: number;
  totalSubs: number;
  attendancePct: number | null;
  activeAttendees: number;
  nextLessonAt: string | null;
  nextLessonTitle: string | null;
  lastLessonAt: string | null;
  lastLessonTitle: string | null;
  health: CourseHealth;
  paymentSum: number;
  paymentCount: number;
};

export type AdminTeacherCourseGroup = {
  teacherId: string;
  teacherName: string;
  subjectName: string;
  facultyName: string;
  hasAccount: boolean;
  courseCount: number;
  activeStudents: number;
  onTrack: number;
  live: number;
  courses: AdminCourseInsight[];
};

function healthOf(input: {
  lessonCount: number;
  liveCount: number;
  scheduledCount: number;
  endedCount: number;
  lastLessonAt: Date | null;
}): CourseHealth {
  if (input.liveCount > 0) return "live";
  if (input.lessonCount === 0) return "empty";
  if (input.scheduledCount > 0) return "on_track";
  if (input.endedCount > 0) {
    if (input.lastLessonAt) {
      const days = (Date.now() - input.lastLessonAt.getTime()) / 86_400_000;
      if (days > 14) return "stale";
    }
    return "idle";
  }
  return "idle";
}

export async function getAdminCourseBoard() {
  const now = new Date();
  const [courses, teachers, faculties, subjects] = await Promise.all([
    prisma.course.findMany({
      include: {
        teacher: {
          select: {
            id: true,
            fullName: true,
            userId: true,
            subject: { select: { nameUz: true } },
            faculty: { select: { nameUz: true } },
          },
        },
        faculty: { select: { nameUz: true } },
        subject: { select: { nameUz: true } },
        subscriptions: { select: { endsAt: true, userId: true } },
        lessons: {
          select: {
            id: true,
            titleUz: true,
            status: true,
            scheduledAt: true,
            attendance: { select: { userId: true } },
          },
          orderBy: { scheduledAt: "asc" },
        },
        payments: {
          where: { status: { in: ["demo_paid", "paid"] } },
          select: { amount: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.teacher.findMany({
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.faculty.findMany({ orderBy: { order: "asc" } }),
    prisma.subject.findMany(),
  ]);

  const insights: AdminCourseInsight[] = courses.map((course) => {
    const activeSubs = course.subscriptions.filter((s) => isSubscriptionActive(s.endsAt));
    const activeStudentIds = new Set(activeSubs.map((s) => s.userId));
    const scheduled = course.lessons.filter((l) => l.status === "scheduled" && l.scheduledAt >= now);
    const live = course.lessons.filter((l) => l.status === "live");
    const ended = course.lessons.filter((l) => l.status === "ended");
    const next = scheduled[0] ?? null;
    const last = [...course.lessons].reverse().find((l) => l.status === "ended" || l.scheduledAt < now) ?? null;

    const endedWithAttend = ended.length > 0 ? ended : course.lessons.filter((l) => l.attendance.length > 0);
    let attendancePct: number | null = null;
    let activeAttendees = 0;
    if (activeStudentIds.size > 0 && endedWithAttend.length > 0) {
      const present = new Set<string>();
      let seats = 0;
      for (const lesson of endedWithAttend) {
        seats += activeStudentIds.size;
        for (const row of lesson.attendance) {
          if (activeStudentIds.has(row.userId)) present.add(`${lesson.id}:${row.userId}`);
        }
      }
      activeAttendees = new Set(
        endedWithAttend.flatMap((l) => l.attendance.map((a) => a.userId)).filter((id) => activeStudentIds.has(id)),
      ).size;
      attendancePct = seats ? Math.round((present.size / seats) * 100) : null;
    }

    return {
      id: course.id,
      titleUz: course.titleUz,
      descriptionUz: course.descriptionUz,
      teacherId: course.teacher.id,
      teacherName: course.teacher.fullName,
      facultyId: course.facultyId,
      facultyName: course.faculty.nameUz,
      subjectId: course.subjectId,
      subjectName: course.subject.nameUz,
      priceT1: course.priceT1,
      priceT2: course.priceT2,
      priceT3: course.priceT3,
      isPublished: course.isPublished,
      lessonCount: course.lessons.length,
      scheduledCount: scheduled.length,
      liveCount: live.length,
      endedCount: ended.length,
      activeStudents: activeSubs.length,
      totalSubs: course.subscriptions.length,
      attendancePct,
      activeAttendees,
      nextLessonAt: next?.scheduledAt.toISOString() ?? null,
      nextLessonTitle: next?.titleUz ?? null,
      lastLessonAt: last?.scheduledAt.toISOString() ?? null,
      lastLessonTitle: last?.titleUz ?? null,
      health: healthOf({
        lessonCount: course.lessons.length,
        liveCount: live.length,
        scheduledCount: scheduled.length,
        endedCount: ended.length,
        lastLessonAt: last?.scheduledAt ?? null,
      }),
      paymentSum: course.payments.reduce((n, p) => n + p.amount, 0),
      paymentCount: course.payments.length,
    };
  });

  const byTeacher = new Map<string, AdminTeacherCourseGroup>();
  for (const course of insights) {
    const group = byTeacher.get(course.teacherId) ?? {
      teacherId: course.teacherId,
      teacherName: course.teacherName,
      subjectName: course.subjectName,
      facultyName: course.facultyName,
      hasAccount: Boolean(courses.find((c) => c.teacher.id === course.teacherId)?.teacher.userId),
      courseCount: 0,
      activeStudents: 0,
      onTrack: 0,
      live: 0,
      courses: [],
    };
    group.courses.push(course);
    group.courseCount += 1;
    group.activeStudents += course.activeStudents;
    if (course.health === "on_track" || course.health === "live") group.onTrack += 1;
    if (course.health === "live") group.live += 1;
    byTeacher.set(course.teacherId, group);
  }

  const groups = [...byTeacher.values()].sort((a, b) => a.teacherName.localeCompare(b.teacherName, "uz"));

  return {
    groups,
    courses: insights,
    teachers,
    faculties: faculties.map((f) => ({ id: f.id, nameUz: f.nameUz })),
    subjects: subjects.map((s) => ({ id: s.id, facultyId: s.facultyId, nameUz: s.nameUz })),
    summary: {
      courses: insights.length,
      teachers: groups.length,
      activeStudents: insights.reduce((n, c) => n + c.activeStudents, 0),
      live: insights.filter((c) => c.health === "live").length,
      onTrack: insights.filter((c) => c.health === "on_track").length,
      empty: insights.filter((c) => c.health === "empty").length,
      stale: insights.filter((c) => c.health === "stale" || c.health === "idle").length,
    },
  };
}
