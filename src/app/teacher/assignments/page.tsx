import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { CreateAssignmentForm } from "@/components/teacher/CreateAssignmentForm";
import { GradeForm } from "@/components/teacher/GradeForm";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
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

  const teacher = await prisma.teacher.findUnique({
    where: { userId: session.user.id },
    include: {
      courses: {
        include: {
          subscriptions: {
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

  return (
    <AppShell active="teacher-assignments">
      <div className="lx-board">
        <p className="lx-kicker">Topshiriqlar</p>
        <h2>Avval kurs, keyin kim topshirdi</h2>
        <p className="muted small lx-lead">
          Kurs ichida kim topshirdi va kim topshirmadi. 3-tarif birinchi.
        </p>
      </div>
      <details className="lx-disclosure">
        <summary>Yangi topshiriq</summary>
        <CreateAssignmentForm courses={teacher.courses.map((c) => ({ id: c.id, titleUz: c.titleUz }))} />
      </details>
      {teacher.courses.map((course) => {
        const students = course.subscriptions.filter((s) => isSubscriptionActive(s.endsAt));
        return (
          <section key={course.id} className="lx-group">
            <h3>{course.titleUz}</h3>
            <p className="small muted" style={{ marginTop: -4 }}>{students.length} ta faol o&apos;quvchi</p>
            {course.assignments.length === 0 ? (
              <p className="small muted">Bu kursda topshiriq yo&apos;q.</p>
            ) : null}
            {course.assignments.map((assignment) => {
              const submissions = [...assignment.submissions].sort((x, y) => {
                const tx = x.user.subscriptions.find((s) => s.courseId === course.id)?.tier;
                const ty = y.user.subscriptions.find((s) => s.courseId === course.id)?.tier;
                return tierRank(tx) - tierRank(ty);
              });
              const sentIds = new Set(submissions.map((s) => s.user.id));
              const missing = students.filter((s) => !sentIds.has(s.userId));
              const late = assignment.dueAt < new Date();
              return (
                <article key={assignment.id} className="card" style={{ marginBottom: 14 }}>
                  <h3>{assignment.titleUz}</h3>
                  <p className="small muted">
                    {course.titleUz} · muddat {formatDateTime(assignment.dueAt)}
                    {late ? " · muddati o'tgan" : ""}
                  </p>
                  <p className="lx-kicker" style={{ marginTop: 14 }}>Topshirdi · {submissions.length}</p>
                  {submissions.length === 0 ? (
                    <p className="small muted">Hali javob yo&apos;q.</p>
                  ) : (
                    submissions.map((s) => {
                      const tier = s.user.subscriptions.find((sub) => sub.courseId === course.id)?.tier;
                      return (
                        <div key={s.id} style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                          <b>{s.user.fullName}</b>
                          {tier ? (
                            <span className={`badge${isPriorityTier(tier) ? " accent" : ""}`} style={{ marginLeft: 8 }}>
                              {TARIFF_LABELS[tier]}
                            </span>
                          ) : null}
                          {s.text ? <p>{s.text}</p> : null}
                          {s.fileUrl ? (
                            <a href={s.fileUrl} className="small" style={{ color: "var(--accent)" }} target="_blank" rel="noreferrer">
                              {s.fileName || "Fayl"}
                            </a>
                          ) : null}
                          <GradeForm submissionId={s.id} initialGrade={s.grade} initialNote={s.teacherNote} />
                        </div>
                      );
                    })
                  )}
                  <p className="lx-kicker" style={{ marginTop: 16 }}>Topshirmadi · {missing.length}</p>
                  {missing.length === 0 ? (
                    <p className="small muted">Hammasi topshirdi.</p>
                  ) : (
                    <div className="lx-miss">
                      {missing.map((s) => <span key={s.userId}>{s.user.fullName}</span>)}
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        );
      })}
    </AppShell>
  );
}
