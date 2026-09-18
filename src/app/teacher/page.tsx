import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import Link from "next/link";
import { LiveStudio } from "@/components/teacher/LiveStudio";
import { SoftDisclosure } from "@/components/admin/SoftDisclosure";
import { CreateCoursePlanForm } from "@/components/teacher/CreateCoursePlanForm";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureTeacherWorkspace } from "@/lib/teacher-workspace";
import { formatDateTime } from "@/lib/utils";
import { hasPlayableRecording, statusLabel } from "@/lib/plan";
import { isSubscriptionActive } from "@/lib/tariffs";

export const dynamic = "force-dynamic";

function countdownLabel(when: Date) {
  const ms = when.getTime() - Date.now();
  if (ms <= 0) return "Vaqti keldi";
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins} daqiqa qoldi`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} soat qoldi`;
  const days = Math.round(hours / 24);
  return `${days} kun qoldi`;
}

export default async function TeacherHomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/teacher");
  if (session.user.role !== "teacher") redirect("/");

  let teacher = await prisma.teacher.findUnique({
    where: { userId: session.user.id },
    include: {
      courses: {
        include: {
          lessons: {
            orderBy: { scheduledAt: "asc" },
            include: { attendance: { select: { userId: true } } },
          },
          subscriptions: {
            include: { user: { select: { id: true, fullName: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!teacher) {
    return (
      <AppShell active="teacher">
        <div className="lx-board">
          <p className="lx-kicker">Studio</p>
          <h2>O&apos;qituvchi studiosi</h2>
          <p className="muted small lx-lead">
            Hisob ochildi. Admin sizni fan bilan bog&apos;lagach reja va efir shu yerda ochiladi.
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
          lessons: {
            orderBy: { scheduledAt: "asc" },
            include: { attendance: { select: { userId: true } } },
          },
          subscriptions: {
            include: { user: { select: { id: true, fullName: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!teacher) redirect("/teacher");

  const allLessons = teacher.courses.flatMap((c) =>
    c.lessons.map((l) => ({ ...l, courseTitle: c.titleUz, courseId: c.id })),
  );
  const activeSession =
    allLessons.find((l) => l.status === "live") ??
    allLessons.find((l) => l.status === "lobby") ??
    allLessons
      .filter((l) => l.status === "scheduled")
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())[0] ??
    null;

  const nextToday = allLessons
    .filter((l) => l.status === "scheduled" || l.status === "lobby")
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())[0];

  const pending = await prisma.submission.count({
    where: { grade: null, assignment: { course: { teacherId: teacher.id } } },
  });

  const courseCards = teacher.courses.map((course) => {
    const ended = course.lessons.filter((l) => l.status === "ended");
    const withVideo = ended.filter((l) =>
      hasPlayableRecording(l.recordingUrl, l.muxVodPlaybackId || l.muxLivePlaybackId),
    ).length;
    const next =
      course.lessons.find((l) => l.status === "live" || l.status === "lobby") ??
      course.lessons.find((l) => l.status === "scheduled");
    const activeStudents = course.subscriptions.filter((s) => isSubscriptionActive(s.endsAt)).length;
    const total = course.lessons.length;
    const phase =
      course.lessons.some((l) => l.status === "live" || l.status === "lobby")
        ? "active"
        : withVideo > 0
          ? "ongoing"
          : total <= 1
            ? "new"
            : "planned";

    return {
      id: course.id,
      titleUz: course.titleUz,
      total,
      withVideo,
      endedCount: ended.length,
      activeStudents,
      next,
      phase,
    };
  });

  return (
    <AppShell active="teacher">
      <div className="lx-board teacher-focus">
        <p className="lx-kicker">Studio</p>
        <h2>Salom, {teacher.fullName}</h2>
        <p className="muted small lx-lead">
          Kurslaringiz, yozuvlar, bugungi dars va efir — bir joyda.
        </p>

        <div className="studio-kpis">
          <div className="studio-kpi">
            <span className="small muted">Kurs</span>
            <b>{teacher.courses.length}</b>
          </div>
          <div className="studio-kpi">
            <span className="small muted">Keyingi</span>
            <b style={{ fontSize: 14 }}>
              {nextToday ? countdownLabel(nextToday.scheduledAt) : "—"}
            </b>
          </div>
          <div className="studio-kpi">
            <span className="small muted">Tekshiruv</span>
            <b>{pending}</b>
          </div>
          <div className="studio-kpi">
            <span className="small muted">Efir</span>
            <b>
              {activeSession?.status === "live"
                ? "Jonli"
                : activeSession?.status === "lobby"
                  ? "Kutish"
                  : "Yo‘q"}
            </b>
          </div>
        </div>

        {nextToday ? (
          <div className="lx-row" style={{ marginTop: 12 }}>
            <div>
              <p className="lx-kicker">Bugun / navbat</p>
              <h3>
                {nextToday.titleUz}{" "}
                <span className="badge pending" style={{ marginLeft: 8 }}>
                  {statusLabel(nextToday.status)}
                </span>
              </h3>
              <p className="small muted" style={{ margin: 0 }}>
                {nextToday.courseTitle} · {formatDateTime(nextToday.scheduledAt)} ·{" "}
                {countdownLabel(nextToday.scheduledAt)}
              </p>
            </div>
            <a href="#live" className="lx-go">
              Ochish
            </a>
          </div>
        ) : null}

        {pending > 0 ? (
          <Link href="/teacher/assignments" className="lx-row" style={{ marginTop: 10 }}>
            <div>
              <p className="lx-kicker">Topshiriq</p>
              <h3>{pending} ta ish baholanmagan</h3>
            </div>
            <span className="lx-go">Ochish</span>
          </Link>
        ) : null}
      </div>

      <div className="lx-board" style={{ marginTop: 18 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <div>
            <p className="lx-kicker">Kurslar</p>
            <h2 style={{ marginBottom: 0 }}>Rejangiz</h2>
          </div>
          <Link href="/teacher/reja" className="btn btn-sm">
            Jadval
          </Link>
        </div>

        <SoftDisclosure title="Yangi kurs qo‘shish" defaultOpen={courseCards.length === 0}>
          <CreateCoursePlanForm />
        </SoftDisclosure>

        <div className="teacher-course-grid">
          {courseCards.map((card) => (
            <article key={card.id} className="teacher-course-card">
              <p className="lx-kicker">
                {card.phase === "new"
                  ? "Yangi"
                  : card.phase === "active"
                    ? "Hozir"
                    : card.phase === "ongoing"
                      ? "Davom etmoqda"
                      : "Rejada"}
              </p>
              <h3>{card.titleUz}</h3>
              <p className="small muted" style={{ margin: "0 0 10px" }}>
                {card.withVideo}/{card.total} yozuv · {card.activeStudents} o‘quvchi
              </p>
              {card.next ? (
                <p className="small" style={{ margin: "0 0 12px" }}>
                  Keyingi: {card.next.titleUz} · {formatDateTime(card.next.scheduledAt)}
                  {card.next.status === "scheduled" || card.next.status === "lobby"
                    ? ` · ${countdownLabel(card.next.scheduledAt)}`
                    : ""}
                </p>
              ) : (
                <p className="small muted" style={{ margin: "0 0 12px" }}>
                  Keyingi dars yo‘q — Rejada qo‘shing.
                </p>
              )}
              <div className="row gap-8" style={{ flexWrap: "wrap" }}>
                {card.next ? (
                  <a href="#live" className="btn btn-primary btn-sm">
                    {card.next.status === "live"
                      ? "Efirga"
                      : card.next.status === "lobby"
                        ? "Kutishga"
                        : "Studioga"}
                  </a>
                ) : null}
                <Link href="/teacher/reja" className="btn btn-sm">
                  Reja
                </Link>
                <Link href="/teacher/group" className="btn btn-sm">
                  Guruh
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>

      {activeSession ? (
        <LiveStudio
          lessonId={activeSession.id}
          titleUz={activeSession.titleUz}
          courseTitle={activeSession.courseTitle}
          whenLabel={formatDateTime(activeSession.scheduledAt)}
          status={activeSession.status}
          streamKey={activeSession.streamKey}
          displayName={teacher.fullName}
        />
      ) : (
        <section id="live" className="live-studio">
          <span className="badge pending">Studio</span>
          <h2 style={{ margin: "8px 0 6px" }}>Hali efir yo&apos;q</h2>
          <p className="muted small" style={{ marginBottom: 12 }}>
            Rejada dars tanlang yoki yangi kurs yarating — keyin kutish xonasini ochasiz.
          </p>
          <Link href="/teacher/reja" className="btn btn-sm btn-primary">
            Rejaga o&apos;tish
          </Link>
        </section>
      )}
    </AppShell>
  );
}
