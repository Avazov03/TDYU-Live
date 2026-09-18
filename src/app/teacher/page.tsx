import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import Link from "next/link";
import { SoftDisclosure } from "@/components/admin/SoftDisclosure";
import { CreateCoursePlanForm } from "@/components/teacher/CreateCoursePlanForm";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureTeacherWorkspace } from "@/lib/teacher-workspace";
import { formatDateTime } from "@/lib/utils";
import { hasPlayableRecording, statusLabel, type PlanStatus } from "@/lib/plan";
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
          lessons: { orderBy: { scheduledAt: "asc" } },
          subscriptions: { select: { endsAt: true } },
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
          lessons: { orderBy: { scheduledAt: "asc" } },
          subscriptions: { select: { endsAt: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!teacher) redirect("/teacher");

  const allLessons = teacher.courses.flatMap((c) =>
    c.lessons.map((l) => ({ ...l, courseTitle: c.titleUz, courseId: c.id })),
  );

  const running = allLessons.filter((l) => l.status === "live" || l.status === "lobby");
  const nextUp = allLessons
    .filter((l) => l.status === "scheduled")
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())[0];

  const pending = await prisma.submission.count({
    where: { grade: null, assignment: { course: { teacherId: teacher.id } } },
  });

  const courseCards = teacher.courses.map((course) => {
    const ended = course.lessons.filter((l) => l.status === "ended");
    const withVideo = ended.filter((l) =>
      hasPlayableRecording(l.recordingUrl, l.muxVodPlaybackId || l.muxLivePlaybackId),
    ).length;
    const actionable = course.lessons.filter(
      (l) => l.status === "live" || l.status === "lobby" || l.status === "scheduled",
    );
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
      activeStudents,
      next,
      actionable,
      phase,
    };
  });

  return (
    <AppShell active="teacher">
      <div className="lx-board teacher-focus">
        <p className="lx-kicker">Studio</p>
        <h2>Salom, {teacher.fullName}</h2>
        <p className="muted small lx-lead">
          Avval <strong>kursni</strong> tanlang — keyin shu kursning darsi uchun kutish/efir ochiladi.
        </p>

        <div className="studio-kpis">
          <div className="studio-kpi">
            <span className="small muted">Kurs</span>
            <b>{teacher.courses.length}</b>
          </div>
          <div className="studio-kpi">
            <span className="small muted">Keyingi</span>
            <b style={{ fontSize: 14 }}>{nextUp ? countdownLabel(nextUp.scheduledAt) : "—"}</b>
          </div>
          <div className="studio-kpi">
            <span className="small muted">Tekshiruv</span>
            <b>{pending}</b>
          </div>
          <div className="studio-kpi">
            <span className="small muted">Faol efir</span>
            <b>{running.length}</b>
          </div>
        </div>

        {running.length > 0 ? (
          <div className="studio-alert-stack" style={{ marginTop: 14 }}>
            {running.map((l) => (
              <Link key={l.id} href={`/teacher/live/${l.id}`} className="lx-row is-live">
                <div>
                  <p className="lx-kicker">
                    {l.status === "live" ? "Jonli efir ketmoqda" : "Kutish xonasi ochiq"}
                  </p>
                  <h3>
                    {l.titleUz}{" "}
                    <span className={`badge ${l.status === "live" ? "danger" : "accent"}`}>
                      {statusLabel(l.status as PlanStatus)}
                    </span>
                  </h3>
                  <p className="small muted" style={{ margin: 0 }}>
                    {l.courseTitle} · {formatDateTime(l.scheduledAt)}
                  </p>
                </div>
                <span className="lx-go">Davom etish</span>
              </Link>
            ))}
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
            <p className="lx-kicker">1-qadam</p>
            <h2 style={{ marginBottom: 0 }}>Kursni tanlang</h2>
          </div>
          <Link href="/teacher/reja" className="btn btn-sm">
            Jadval
          </Link>
        </div>
        <p className="muted small lx-lead">
          «Studioga» — shu kursning navbatdagi darsi. Efir faqat tanlangan dars uchun ochiladi.
        </p>

        <SoftDisclosure title="Yangi kurs qo‘shish" defaultOpen={courseCards.length === 0}>
          <CreateCoursePlanForm />
        </SoftDisclosure>

        {courseCards.length === 0 ? (
          <p className="muted small">Hali kurs yo‘q — yuqoridan yarating.</p>
        ) : (
          <div className="teacher-course-grid">
            {courseCards.map((card) => (
              <article
                key={card.id}
                className={`teacher-course-card${card.phase === "active" ? " is-active" : ""}`}
              >
                <p className="lx-kicker">
                  {card.phase === "new"
                    ? "Yangi"
                    : card.phase === "active"
                      ? "Hozir faol"
                      : card.phase === "ongoing"
                        ? "Davom etmoqda"
                        : "Rejada"}
                </p>
                <h3>{card.titleUz}</h3>
                <p className="small muted" style={{ margin: "0 0 10px" }}>
                  {card.withVideo}/{card.total} yozuv · {card.activeStudents} o‘quvchi
                </p>

                {card.next ? (
                  <div className="teacher-course-next">
                    <p className="lx-kicker">Navbatdagi dars</p>
                    <p style={{ margin: "0 0 4px", fontWeight: 600 }}>{card.next.titleUz}</p>
                    <p className="small muted" style={{ margin: 0 }}>
                      {formatDateTime(card.next.scheduledAt)}
                      {" · "}
                      {statusLabel(card.next.status as PlanStatus)}
                      {card.next.status === "scheduled" ? ` · ${countdownLabel(card.next.scheduledAt)}` : ""}
                    </p>
                  </div>
                ) : (
                  <p className="small muted" style={{ margin: "0 0 12px" }}>
                    Keyingi dars yo‘q — Rejada qo‘shing.
                  </p>
                )}

                {card.actionable.length > 1 ? (
                  <details className="teacher-course-lessons">
                    <summary>Boshqa darsni tanlash ({card.actionable.length})</summary>
                    <ul>
                      {card.actionable.map((l) => (
                        <li key={l.id}>
                          <Link href={`/teacher/live/${l.id}`}>
                            {l.titleUz}
                            {" · "}
                            {statusLabel(l.status as PlanStatus)}
                            {" · "}
                            {formatDateTime(l.scheduledAt)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}

                <div className="row gap-8" style={{ flexWrap: "wrap", marginTop: 12 }}>
                  {card.next ? (
                    <Link href={`/teacher/live/${card.next.id}`} className="btn btn-primary btn-sm">
                      {card.next.status === "live"
                        ? "Efirga qaytish"
                        : card.next.status === "lobby"
                          ? "Kutishga qaytish"
                          : "Studioga — shu dars"}
                    </Link>
                  ) : (
                    <Link href="/teacher/reja" className="btn btn-primary btn-sm">
                      Dars qo‘shish
                    </Link>
                  )}
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
        )}
      </div>
    </AppShell>
  );
}
