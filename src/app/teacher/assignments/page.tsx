import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { CreateAssignmentForm } from "@/components/teacher/CreateAssignmentForm";
import { GradeForm } from "@/components/teacher/GradeForm";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { TARIFF_LABELS, isPriorityTier } from "@/lib/tariffs";
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
          assignments: {
            include: {
              submissions: {
                include: {
                  user: {
                    select: {
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
            orderBy: { dueAt: "desc" },
          },
        },
      },
    },
  });
  if (!teacher) redirect("/teacher");

  return (
    <AppShell active="teacher-assignments">
      <h2 style={{ marginBottom: 8 }}>Topshiriqlar</h2>
      <p className="muted small" style={{ marginBottom: 16 }}>
        3-tarif ishlari ro&apos;yxat boshida — avval ularni tekshiring.
      </p>
      <CreateAssignmentForm courses={teacher.courses.map((c) => ({ id: c.id, titleUz: c.titleUz }))} />
      {teacher.courses.flatMap((c) =>
        c.assignments.map((a) => {
          const submissions = [...a.submissions].sort((x, y) => {
            const tx = x.user.subscriptions.find((s) => s.courseId === c.id)?.tier;
            const ty = y.user.subscriptions.find((s) => s.courseId === c.id)?.tier;
            return tierRank(tx) - tierRank(ty);
          });
          return (
            <div key={a.id} className="card" style={{ marginBottom: 14 }}>
              <h3>{a.titleUz}</h3>
              <p className="small muted">
                {c.titleUz} · {formatDateTime(a.dueAt)}
              </p>
              {submissions.length === 0 ? (
                <p className="small muted">Hali javob yo&apos;q.</p>
              ) : (
                submissions.map((s) => {
                  const tier = s.user.subscriptions.find((sub) => sub.courseId === c.id)?.tier;
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
            </div>
          );
        }),
      )}
    </AppShell>
  );
}
