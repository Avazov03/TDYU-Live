import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import Link from "next/link";
import { SoftDisclosure } from "@/components/admin/SoftDisclosure";
import { CreateCoursePlanForm } from "@/components/teacher/CreateCoursePlanForm";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureTeacherWorkspace } from "@/lib/teacher-workspace";
import { UZ_MONTHS_SHORT, tashkentParts } from "@/lib/utils";
import { clockLabel, dayTitle, hasPlayableRecording, statusLabel, type PlanStatus } from "@/lib/plan";
import { Icon } from "@/components/ui/Icon";
import { isSubscriptionActive } from "@/lib/tariffs";
import {
  getEnrollmentAccessMode,
  isCourseCompletionV1Enabled,
  isCourseReviewV1Enabled,
  isRefundsV1Enabled,
} from "@/lib/feature-flags";
import { hasCourseStarted } from "@/lib/refund-policy";
import { CancelCourseButton } from "@/components/teacher/CancelCourseButton";
import { isLiveAllowedForCourse, liveGate } from "@/lib/course-review-policy";
import { TeacherCourseReviewPanel } from "@/components/teacher/TeacherCourseReviewPanel";
import { CompleteCourseButton } from "@/components/teacher/CompleteCourseButton";
import { isOpenLessonStatus } from "@/lib/course-completion-policy";
import { isRunningLessonStatus } from "@/lib/schedule-policy";

export const dynamic = "force-dynamic";

/** Students are in the room right now (live, or paused by the teacher). */
function isOnAir(status: string) {
  return status === "live" || status === "paused";
}

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

  const profile = await prisma.teacher.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!profile) {
    return (
      <AppShell active="teacher">
        <div className="lx-today">
          <header className="lx-today-head">
            <p className="lx-kicker">Studio</p>
            <h1 className="lx-today-title">Salom!</h1>
          </header>
          <div className="lx-mc-empty">
            <h2>Hisobingiz ochildi</h2>
            <p>Admin sizni fan bilan bog‘lagach, kurslar, reja va efir shu yerda ochiladi.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  await ensureTeacherWorkspace(profile.id);
  const reviewFlow = isCourseReviewV1Enabled();
  const completionFlow = isCourseCompletionV1Enabled();
  const refundsFlow = isRefundsV1Enabled();
  const accessMode = getEnrollmentAccessMode();
  const teacher = await prisma.teacher.findUnique({
    where: { id: profile.id },
    include: {
      courses: {
        include: {
          lessons: { orderBy: { scheduledAt: "asc" } },
          subscriptions: { select: { endsAt: true, userId: true } },
          enrollments: {
            where: { accessOpen: true, status: { in: ["active", "completed"] } },
            select: { userId: true },
          },
          reviewEvents: {
            where: { decision: { in: ["changes_requested", "rejected"] } },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { reason: true },
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

  const running = allLessons
    .filter((l) => isRunningLessonStatus(l.status))
    .sort((a, b) => Number(isOnAir(b.status)) - Number(isOnAir(a.status)));
  const gatedCourseIds = new Set(
    teacher.courses.filter((c) => liveGate(c.lifecycleStatus, reviewFlow)).map((c) => c.id),
  );
  const nextUp = allLessons
    .filter((l) => l.status === "scheduled" && !gatedCourseIds.has(l.courseId))
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())[0];

  const pending = await prisma.submission.count({
    where: { grade: null, assignment: { course: { teacherId: teacher.id } } },
  });

  const courseCards = teacher.courses.map((course) => {
    const ended = course.lessons.filter((l) => l.status !== "cancelled" && !isOpenLessonStatus(l.status));
    const withVideo = ended.filter((l) =>
      hasPlayableRecording(l.recordingUrl, l.muxVodPlaybackId),
    ).length;
    const actionable = course.lessons.filter(
      (l) => isRunningLessonStatus(l.status) || l.status === "scheduled",
    );
    const toReview = course.lessons.filter(
      (l) => l.status === "teacher_review" || l.status === "recording_ready",
    );
    const next =
      course.lessons.find((l) => isOnAir(l.status)) ??
      course.lessons.find((l) => isRunningLessonStatus(l.status)) ??
      course.lessons.find((l) => l.status === "scheduled");
    const studentIds = new Set<string>();
    if (accessMode !== "enrollment") {
      for (const s of course.subscriptions) if (isSubscriptionActive(s.endsAt)) studentIds.add(s.userId);
    }
    if (accessMode === "enrollment" || accessMode === "dual") {
      for (const e of course.enrollments) studentIds.add(e.userId);
    }
    const activeStudents = studentIds.size;
    const total = course.lessons.length;
    const phase =
      course.lessons.some((l) => isRunningLessonStatus(l.status))
        ? "active"
        : withVideo > 0
          ? "ongoing"
          : total <= 1
            ? "new"
            : "planned";

    return {
      id: course.id,
      titleUz: course.titleUz,
      descriptionUz: course.descriptionUz,
      topicUz: course.topicUz,
      lifecycleStatus: course.lifecycleStatus,
      reviewReason: course.reviewEvents?.[0]?.reason ?? null,
      inReview:
        reviewFlow &&
        course.lifecycleStatus !== "completed" &&
        course.lifecycleStatus !== "cancelled" &&
        !isLiveAllowedForCourse(course.lifecycleStatus),
      total,
      withVideo,
      activeStudents,
      next,
      actionable,
      toReview,
      phase,
      completed: course.lifecycleStatus === "completed",
      cancelled: course.lifecycleStatus === "cancelled",
      canComplete:
        completionFlow && course.lifecycleStatus === "active" && actionable.length === 0,
      canCancel:
        refundsFlow &&
        (course.lifecycleStatus === "published" || course.lifecycleStatus === "upcoming") &&
        !hasCourseStarted({
          lifecycleStatus: course.lifecycleStatus,
          lessonStatuses: course.lessons.map((l) => l.status),
        }),
    };
  });

  const focus = running[0] ?? nextUp ?? null;
  const focusLive = Boolean(running[0]);
  const studentTotal = new Set(
    teacher.courses.flatMap((c) => [
      ...(accessMode !== "enrollment"
        ? c.subscriptions.filter((s) => isSubscriptionActive(s.endsAt)).map((s) => s.userId)
        : []),
      ...(accessMode === "enrollment" || accessMode === "dual" ? c.enrollments.map((e) => e.userId) : []),
    ]),
  ).size;
  const activeCourseCount = courseCards.filter((c) => !c.completed && !c.cancelled && !c.inReview).length;
  const unapprovedCount = courseCards.filter((c) => c.inReview).length;
  // No lesson can go live yet — point at the step that unblocks it instead of an empty "no lessons" card.
  const gatedStep = focus
    ? null
    : (() => {
        const card =
          courseCards.find((c) => c.inReview && c.total > 0 && liveGate(c.lifecycleStatus, reviewFlow)?.canSubmit) ??
          courseCards.find((c) => c.inReview && c.total > 0);
        const gate = card ? liveGate(card.lifecycleStatus, reviewFlow) : null;
        return card && gate ? { card, gate } : null;
      })();
  const reviewCount = courseCards.reduce((n, c) => n + c.toReview.length, 0);
  const firstName = teacher.fullName.trim().split(/\s+/)[0] || teacher.fullName;

  return (
    <AppShell active="teacher">
      <div className="lx-today lx-studio">
        <header className="lx-today-head">
          <p className="lx-kicker">Studio</p>
          <h1 className="lx-today-title">Salom, {firstName}!</h1>
          <p className="lx-today-sub">
            {activeCourseCount} ta faol kurs
            {unapprovedCount > 0 ? ` · ${unapprovedCount} tasi tasdiqlanmagan` : ""} · {studentTotal} ta o‘quvchi
          </p>
        </header>

        {focus ? (
          <section
            className={`lx-mc-next lx-today-focus${focusLive ? " is-live" : ""}`}
            aria-label={focusLive ? "Jonli efir" : "Keyingi dars"}
          >
            <div className="lx-mc-next-info">
              <span className="lx-mc-next-label">
                {focus.status === "live"
                  ? "Hozir efirdasiz"
                  : focus.status === "paused"
                    ? "Efir pauzada"
                    : focusLive
                      ? "Kutish xonasi ochiq"
                      : "Keyingi darsingiz"}
              </span>
              <p className="lx-mc-next-title">{focus.courseTitle}</p>
              <p className="lx-mc-next-meta">
                Dars: {focus.titleUz} ·{" "}
                <strong>
                  {dayTitle(focus.scheduledAt)} · {clockLabel(focus.scheduledAt)}
                </strong>
                {!focusLive ? ` · ${countdownLabel(focus.scheduledAt)}` : ""}
              </p>
              {running.length > 1 ? (
                <p className="lx-mc-next-meta">Yana {running.length - 1} ta efir ochiq — kurs kartalarida.</p>
              ) : null}
            </div>
            <Link href={`/teacher/live/${focus.id}`} className="btn btn-primary lx-mc-next-cta">
              {isOnAir(focus.status) ? "Efirga qaytish" : focusLive ? "Kutish xonasiga" : "Darsni boshlash"}
            </Link>
          </section>
        ) : gatedStep ? (
          <section className="lx-mc-next lx-today-focus" aria-label="Keyingi qadam" data-testid="studio-gated-step">
            <div className="lx-mc-next-info">
              <span className="lx-mc-next-label">
                {gatedStep.gate.canSubmit ? "Keyingi qadam" : `Kurs: ${gatedStep.gate.label}`}
              </span>
              <p className="lx-mc-next-title">
                {gatedStep.gate.canSubmit
                  ? `«${gatedStep.card.titleUz}» kursini tekshiruvga yuboring`
                  : gatedStep.card.titleUz}
              </p>
              <p className="lx-mc-next-meta">
                {gatedStep.card.total} ta dars rejada · {gatedStep.gate.hint}
              </p>
            </div>
            <a href="#kurslar" className="btn btn-primary lx-mc-next-cta">
              {gatedStep.gate.canSubmit ? "Kursga o‘tish" : "Kursni ko‘rish"}
            </a>
          </section>
        ) : (
          <section className="lx-mc-next lx-today-focus" aria-label="Keyingi dars">
            <div className="lx-mc-next-info">
              <span className="lx-mc-next-label">Keyingi darsingiz</span>
              <p className="lx-mc-next-title">Rejada dars yo‘q</p>
              <p className="lx-mc-next-meta">Kursga dars qo‘shing — shu yerda chiqadi.</p>
            </div>
            <Link href="/teacher/reja" className="btn btn-primary lx-mc-next-cta">
              Dars qo‘shish
            </Link>
          </section>
        )}

        <div className="lx-today-stats">
          <Link href="/teacher/group" className="lx-today-stat">
            <span className="lx-today-stat-icon">
              <Icon name="users" size={18} />
            </span>
            <span className="lx-today-stat-num">{studentTotal}</span>
            <span className="lx-today-stat-label">O‘quvchi</span>
          </Link>
          <Link href="/teacher/assignments" className={`lx-today-stat${pending > 0 ? " is-alert" : ""}`}>
            <span className="lx-today-stat-icon">
              <Icon name="file" size={18} />
            </span>
            <span className="lx-today-stat-num">{pending}</span>
            <span className="lx-today-stat-label">Baholanmagan ish</span>
          </Link>
          <a href="#kurslar" className={`lx-today-stat${reviewCount > 0 ? " is-alert" : ""}`}>
            <span className="lx-today-stat-icon">
              <Icon name="video" size={18} />
            </span>
            <span className="lx-today-stat-num">{reviewCount}</span>
            <span className="lx-today-stat-label">Yozuv tekshiruvda</span>
          </a>
        </div>

        <section id="kurslar" className="lx-studio-courses">
          <div className="lx-cd-blockhead">
            <h2 className="lx-cd-h2">Kurslarim</h2>
            <Link href="/teacher/reja" className="lx-today-more">
              Dars rejasi →
            </Link>
          </div>

          <SoftDisclosure title="Yangi kurs qo‘shish" defaultOpen={courseCards.length === 0}>
            <CreateCoursePlanForm />
          </SoftDisclosure>

          {courseCards.length === 0 ? (
            <p className="lx-today-empty">Hali kurs yo‘q — yuqoridan yarating.</p>
          ) : (
            <div className="lx-tc-grid">
              {courseCards.map((card) => {
                const phase = card.cancelled
                  ? { text: "Bekor qilingan", tone: "muted" }
                  : card.completed
                    ? { text: "Yakunlangan", tone: "done" }
                    : card.phase === "active"
                      ? {
                          text:
                            card.next?.status === "paused"
                              ? "Efir pauzada"
                              : card.next?.status === "live"
                                ? "Hozir efirda"
                                : "Kutish ochiq",
                          tone: "live",
                        }
                      : card.phase === "ongoing"
                        ? { text: "Davom etmoqda", tone: "open" }
                        : card.phase === "new"
                          ? { text: "Yangi", tone: "open" }
                          : { text: "Rejada", tone: "open" };
                const nextOpen = card.next && card.next.status !== "scheduled";
                const nextDate = card.next ? tashkentParts(card.next.scheduledAt) : null;
                const pct = card.total ? Math.round((card.withVideo / card.total) * 100) : 0;
                return (
                  <article
                    key={card.id}
                    className={`lx-tc-card${card.phase === "active" ? " is-live" : ""}${
                      card.cancelled ? " is-cancelled" : ""
                    }`}
                  >
                    {card.inReview ? (
                      <TeacherCourseReviewPanel
                        course={{
                          id: card.id,
                          titleUz: card.titleUz,
                          descriptionUz: card.descriptionUz,
                          topicUz: card.topicUz,
                          lifecycleStatus: card.lifecycleStatus,
                          reviewReason: card.reviewReason,
                          lessonCount: card.total,
                        }}
                      />
                    ) : (
                      <>
                        <div className="lx-tc-top">
                          <span className={`lx-tc-phase is-${phase.tone}`}>{phase.text}</span>
                          <span className="lx-tc-count">
                            <Icon name="users" size={14} /> {card.activeStudents}
                          </span>
                        </div>
                        <h3 className="lx-tc-title">{card.titleUz}</h3>
                        <div className="lx-mc-progress">
                          <div className="lx-mc-progress-row">
                            <span>Yozuvlar</span>
                            <span>
                              {card.withVideo} / {card.total}
                            </span>
                          </div>
                          <div className="lx-mc-bar">
                            <span style={{ width: `${pct}%` }} />
                          </div>
                        </div>

                        {card.toReview.length > 0 ? (
                          <div className="lx-tc-review" data-testid="recording-review-due">
                            <p className="lx-tc-label">Yozuv tekshiruvingizni kutmoqda</p>
                            {card.toReview.map((l) => (
                              <Link key={l.id} href={`/learn/${l.id}`}>
                                {l.titleUz} — ko‘rib, chop etish →
                              </Link>
                            ))}
                          </div>
                        ) : null}

                        {card.next && nextDate ? (
                          <div className={`lx-tc-next${nextOpen ? " is-live" : ""}`}>
                            <span className="lx-cd-date">
                              <strong>{Number(nextDate.day)}</strong>
                              <span>{UZ_MONTHS_SHORT[nextDate.monthIndex]}</span>
                            </span>
                            <span className="lx-tc-next-info">
                              <span className="lx-tc-label">
                                {nextOpen ? statusLabel(card.next.status as PlanStatus) : "Navbatdagi dars"}
                              </span>
                              <span className="lx-tc-next-title">{card.next.titleUz}</span>
                              <span className="lx-tc-next-sub">
                                {dayTitle(card.next.scheduledAt)} · {clockLabel(card.next.scheduledAt)}
                                {card.next.status === "scheduled" ? ` · ${countdownLabel(card.next.scheduledAt)}` : ""}
                              </span>
                            </span>
                          </div>
                        ) : (
                          <p className="lx-tc-note">
                            {card.cancelled
                              ? "Kurs bekor qilingan — xaridorlarga to‘lov qaytarilgan."
                              : card.completed
                                ? "Kurs yakunlangan — yozuvlar o‘quvchilarga doimiy ochiq."
                                : "Keyingi dars yo‘q — rejaga dars qo‘shing."}
                          </p>
                        )}

                        {card.actionable.length > 1 ? (
                          <details className="lx-tc-more">
                            <summary>Boshqa darsni tanlash ({card.actionable.length})</summary>
                            <ul>
                              {card.actionable.map((l) => (
                                <li key={l.id}>
                                  <Link href={`/teacher/live/${l.id}`}>
                                    <span>{l.titleUz}</span>
                                    <span>
                                      {statusLabel(l.status as PlanStatus)} · {dayTitle(l.scheduledAt)},{" "}
                                      {clockLabel(l.scheduledAt)}
                                    </span>
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </details>
                        ) : null}

                        <div className="lx-tc-actions">
                          {card.next ? (
                            <Link href={`/teacher/live/${card.next.id}`} className="btn btn-primary">
                              {isOnAir(card.next.status)
                                ? "Efirga qaytish"
                                : isRunningLessonStatus(card.next.status)
                                  ? "Kutish xonasiga"
                                  : "Darsni boshlash"}
                            </Link>
                          ) : card.completed || card.cancelled ? null : (
                            <Link href="/teacher/reja" className="btn btn-primary">
                              Dars qo‘shish
                            </Link>
                          )}
                          <Link href="/teacher/reja" className="btn">
                            Reja
                          </Link>
                          <Link href="/teacher/group" className="btn">
                            Guruh
                          </Link>
                        </div>
                        {card.canComplete || card.canCancel ? (
                          <div className="lx-tc-danger">
                            {card.canComplete ? <CompleteCourseButton courseId={card.id} /> : null}
                            {card.canCancel ? (
                              <CancelCourseButton courseId={card.id} buyers={card.activeStudents} />
                            ) : null}
                          </div>
                        ) : null}
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
