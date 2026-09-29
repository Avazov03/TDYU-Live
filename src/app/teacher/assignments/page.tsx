import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { SoftDisclosure } from "@/components/admin/SoftDisclosure";
import { CreateAssignmentForm } from "@/components/teacher/CreateAssignmentForm";
import { GradeForm } from "@/components/teacher/GradeForm";
import { Icon } from "@/components/ui/Icon";
import { auth } from "@/lib/auth";
import { getEnrollmentAccessMode } from "@/lib/feature-flags";
import { clockLabel, dayTitle } from "@/lib/plan";
import { prisma } from "@/lib/prisma";
import { initials } from "@/lib/utils";
import { TARIFF_LABELS, isPriorityTier, isSubscriptionActive } from "@/lib/tariffs";
import type { TariffTier } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

function tierRank(tier: TariffTier | undefined) {
  if (tier === "t3") return 0;
  if (tier === "t2") return 1;
  return 2;
}

export default async function TeacherAssignmentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/teacher/assignments");
  if (session.user.role !== "teacher") redirect("/");

  const mode = getEnrollmentAccessMode();
  const teacher = await prisma.teacher.findUnique({
    where: { userId: session.user.id },
    include: {
      courses: {
        include: {
          subscriptions: {
            include: { user: { select: { id: true, fullName: true } } },
          },
          enrollments: {
            where: { accessOpen: true, status: { in: ["active", "completed"] } },
            include: { user: { select: { id: true, fullName: true } } },
          },
          assignments: {
            include: {
              submissions: {
                include: {
                  user: {
                    select: {
                      id: true,
                      fullName: true,
                      subscriptions: {
                        where: { endsAt: { gt: new Date() } },
                        select: { tier: true, courseId: true },
                      },
                    },
                  },
                },
              },
            },
            orderBy: { dueAt: "asc" },
          },
        },
      },
    },
  });
  if (!teacher) redirect("/teacher");

  const now = new Date();
  const withAssignments = teacher.courses.filter((c) => c.assignments.length > 0);
  const assignmentTotal = withAssignments.reduce((n, c) => n + c.assignments.length, 0);
  const ungradedTotal = withAssignments.reduce(
    (n, c) => n + c.assignments.reduce((m, a) => m + a.submissions.filter((s) => s.grade == null).length, 0),
    0,
  );

  return (
    <AppShell active="teacher-assignments">
      <div className="lx-sc">
        <header className="lx-mc-head">
          <div>
            <p className="lx-kicker">Topshiriqlar</p>
            <h1 className="lx-mc-title">Topshiriqlar</h1>
            <p className="lx-mc-sub">
              {assignmentTotal} ta topshiriq
              {ungradedTotal > 0 ? ` · ${ungradedTotal} ta javob baholanmagan` : ""}
            </p>
          </div>
        </header>

        <div className="lx-reja-tools">
          <SoftDisclosure title="Yangi topshiriq" defaultOpen={assignmentTotal === 0 && teacher.courses.length > 0}>
            <CreateAssignmentForm courses={teacher.courses.map((c) => ({ id: c.id, titleUz: c.titleUz }))} />
          </SoftDisclosure>
        </div>

        {withAssignments.length === 0 ? (
          <div className="lx-mc-empty">
            <h2>Hali topshiriq yo‘q</h2>
            <p>Yuqoridagi «Yangi topshiriq» orqali kursingizga birinchi topshiriqni qo‘shing.</p>
          </div>
        ) : (
          <div className="lx-hist">
            {withAssignments.map((course) => {
              const students = new Map<string, string>();
              if (mode !== "enrollment") {
                for (const s of course.subscriptions) {
                  if (isSubscriptionActive(s.endsAt)) students.set(s.userId, s.user.fullName);
                }
              }
              if (mode === "enrollment" || mode === "dual") {
                for (const e of course.enrollments) students.set(e.userId, e.user.fullName);
              }
              return (
                <section key={course.id} className="lx-grp-course">
                  <div className="lx-grp-head">
                    <h2 className="lx-cd-h2">{course.titleUz}</h2>
                    <span className="lx-grp-stats">
                      {students.size} ta o‘quvchi · {course.assignments.length} ta topshiriq
                    </span>
                  </div>
                  <div className="lx-sc-day">
                    {[...course.assignments]
                      .sort((a, b) => {
                        const al = a.dueAt < now;
                        const bl = b.dueAt < now;
                        if (al !== bl) return al ? 1 : -1;
                        return al
                          ? b.dueAt.getTime() - a.dueAt.getTime()
                          : a.dueAt.getTime() - b.dueAt.getTime();
                      })
                      .map((assignment) => {
                      const submissions = [...assignment.submissions].sort((x, y) => {
                        const tx = x.user.subscriptions.find((s) => s.courseId === course.id)?.tier;
                        const ty = y.user.subscriptions.find((s) => s.courseId === course.id)?.tier;
                        return (x.grade == null ? 0 : 1) - (y.grade == null ? 0 : 1) || tierRank(tx) - tierRank(ty);
                      });
                      const sentIds = new Set(submissions.map((s) => s.user.id));
                      const missing = [...students.entries()].filter(([id]) => !sentIds.has(id));
                      const ungraded = submissions.filter((s) => s.grade == null).length;
                      const late = assignment.dueAt < now;
                      const pct = students.size
                        ? Math.min(100, Math.round((submissions.length / students.size) * 100))
                        : 0;
                      return (
                        <article
                          key={assignment.id}
                          className={`lx-as-card lx-tas-card${late ? " is-closed" : ""}`}
                          data-testid="teacher-assignment"
                        >
                          <div className="lx-as-top">
                            <span className={`lx-as-state${late ? " is-closed" : ""}`}>
                              {late ? "Muddati tugagan" : "Ochiq"}
                            </span>
                            <span className="lx-as-due">
                              <Icon name="clock" size={14} /> {dayTitle(assignment.dueAt)},{" "}
                              {clockLabel(assignment.dueAt)} gacha
                            </span>
                          </div>
                          <h3 className="lx-as-title">{assignment.titleUz}</h3>
                          {assignment.descriptionUz ? (
                            <p className="lx-as-desc">{assignment.descriptionUz}</p>
                          ) : null}

                          <div className="lx-tas-progress">
                            <div className="lx-mc-progress-row">
                              <span>
                                Topshirdi {submissions.length} / {students.size}
                              </span>
                              {ungraded > 0 ? (
                                <span className="lx-tas-ungraded">{ungraded} ta baholanmagan</span>
                              ) : submissions.length > 0 ? (
                                <span>Hammasi baholangan</span>
                              ) : null}
                            </div>
                            <div className="lx-mc-bar">
                              <span style={{ width: `${pct}%` }} />
                            </div>
                          </div>

                          {submissions.length > 0 ? (
                            <details className="lx-tas-subs" open={ungraded > 0}>
                              <summary>Javoblar ({submissions.length})</summary>
                              <div className="lx-tas-sublist">
                                {submissions.map((s) => {
                                  const tier = s.user.subscriptions.find((sub) => sub.courseId === course.id)?.tier;
                                  return (
                                    <div key={s.id} className="lx-tas-sub">
                                      <div className="lx-tas-subhead">
                                        <span className="avatar sm" aria-hidden>
                                          {initials(s.user.fullName)}
                                        </span>
                                        <strong>{s.user.fullName}</strong>
                                        {tier ? (
                                          <span className={`lx-cd-pill${isPriorityTier(tier) ? " is-accent" : ""}`}>
                                            {TARIFF_LABELS[tier]}
                                          </span>
                                        ) : null}
                                        <span className={`lx-as-state${s.grade == null ? " is-late" : " is-done"}`}>
                                          {s.grade == null ? "Baholanmagan" : `Baho: ${s.grade}`}
                                        </span>
                                      </div>
                                      {s.text ? <p className="lx-tas-text">{s.text}</p> : null}
                                      {s.fileUrl ? (
                                        <a href={s.fileUrl} className="lx-tas-file" target="_blank" rel="noreferrer">
                                          <Icon name="file" size={14} /> {s.fileName || "Fayl"}
                                        </a>
                                      ) : null}
                                      <GradeForm
                                        submissionId={s.id}
                                        initialGrade={s.grade}
                                        initialNote={s.teacherNote}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </details>
                          ) : (
                            <p className="lx-tas-empty">Hali javob yo‘q.</p>
                          )}

                          {missing.length > 0 ? (
                            <div className="lx-tas-missing">
                              <p className="lx-tc-label">Topshirmadi · {missing.length}</p>
                              <div className="lx-miss">
                                {missing.map(([id, name]) => (
                                  <span key={id}>{name}</span>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
