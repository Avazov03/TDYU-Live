import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import Link from "next/link";
import { LiveStudio } from "@/components/teacher/LiveStudio";
import { TeacherHub } from "@/components/teacher/TeacherHub";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureTeacherWorkspace } from "@/lib/teacher-workspace";
import { formatDateTime } from "@/lib/utils";
import { isSubscriptionActive } from "@/lib/tariffs";

export const dynamic = "force-dynamic";

export default async function TeacherHomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/teacher");
  if (session.user.role !== "teacher") redirect("/");

  let teacher = await prisma.teacher.findUnique({
    where: { userId: session.user.id },
    include: {
      courses: {
        include: {
          lessons: { orderBy: { scheduledAt: "desc" } },
          subscriptions: { select: { endsAt: true, userId: true } },
        },
      },
    },
  });

  if (!teacher) {
    return (
      <AppShell active="teacher">
        <div className="studio-head">
          <h2>O&apos;qituvchi studiosi</h2>
          <p className="muted" style={{ marginTop: 8, maxWidth: 520 }}>
            Hisob ochildi. Admin sizni fan bilan bog&apos;lagach shu yerda uch ish joyi chiqadi:
            jonli dars, dars rejalash va o&apos;quvchilar.
          </p>
        </div>
      </AppShell>
    );
  }

  await ensureTeacherWorkspace(teacher.id);
  teacher = await prisma.teacher.findUnique({
    where: { id: teacher.id },
    include: {
      courses: {
        include: {
          lessons: { orderBy: { scheduledAt: "desc" } },
          subscriptions: { select: { endsAt: true, userId: true } },
        },
      },
    },
  });
  if (!teacher) redirect("/teacher");

  const lessons = teacher.courses.flatMap((c) =>
    c.lessons.map((l) => ({ ...l, courseTitle: c.titleUz })),
  );
  const live = lessons.find((l) => l.status === "live");
  const next = lessons
    .filter((l) => l.status === "scheduled")
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())[0];
  const studio = live ?? next;
  const studentIds = new Set<string>();
  for (const course of teacher.courses) {
    for (const row of course.subscriptions) {
      if (isSubscriptionActive(row.endsAt)) studentIds.add(row.userId);
    }
  }
  const studentCount = studentIds.size;
  const pending = await prisma.submission.count({
    where: { grade: null, assignment: { course: { teacherId: teacher.id } } },
  });

  return (
    <AppShell active="teacher">
      <TeacherHub
        teacherName={teacher.fullName}
        courseCount={teacher.courses.length}
        upcomingCount={lessons.filter((l) => l.status === "scheduled").length}
        studentCount={studentCount}
        isLive={Boolean(live)}
      />

      {studio ? (
        <LiveStudio
          lessonId={studio.id}
          titleUz={studio.titleUz}
          courseTitle={studio.courseTitle}
          whenLabel={formatDateTime(studio.scheduledAt)}
          status={studio.status}
          streamKey={studio.streamKey}
          displayName={teacher.fullName}
        />
      ) : (
        <section id="live" className="live-studio">
          <span className="badge pending">Studio</span>
          <h2 style={{ margin: "8px 0 6px" }}>Hali efir yo&apos;q</h2>
          <p className="muted small" style={{ marginBottom: 12 }}>
            «Hozir efir» bosing yoki Rejada mavzu qo&apos;shing — keyin shu yerda kamera ochiladi.
          </p>
          <Link href="/teacher/reja" className="btn btn-sm btn-primary">Rejaga o&apos;tish</Link>
        </section>
      )}

      {pending > 0 ? (
        <Link href="/teacher/assignments" className="lx-row" style={{ marginTop: 16 }}>
          <div>
            <p className="lx-kicker">Tekshiruv</p>
            <h3>{pending} ta ish baholanmagan</h3>
          </div>
          <span className="lx-go">Ochish</span>
        </Link>
      ) : null}
    </AppShell>
  );
}
