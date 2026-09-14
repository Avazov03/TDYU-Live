import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { IssueCertificateButton } from "@/components/teacher/IssueCertificateButton";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TARIFF_LABELS, isSubscriptionActive } from "@/lib/tariffs";
import { formatDateTime } from "@/lib/utils";
import { ensureTeacherWorkspace } from "@/lib/teacher-workspace";
import type { TariffTier } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const TIERS: TariffTier[] = ["t3", "t2", "t1"];
const TIER_NOTES: Record<TariffTier, string> = {
  t3: "Premium — ustuvor savol va topshiriq",
  t2: "Jonli efir va chat",
  t1: "Faqat yozuv — guruh chatiga kirmaydi",
};

export default async function TeacherGroupPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/teacher/group");
  if (session.user.role !== "teacher") redirect("/");

  const teacher = await prisma.teacher.findUnique({
    where: { userId: session.user.id },
    include: {
      courses: {
        include: {
          subscriptions: {
            include: {
              user: { select: { id: true, fullName: true, email: true } },
            },
          },
          certificates: true,
          lessons: {
            include: { attendance: true },
          },
        },
      },
    },
  });

  if (!teacher) redirect("/teacher");
  await ensureTeacherWorkspace(teacher.id);
  const workspace = await prisma.teacher.findUnique({
    where: { id: teacher.id },
    include: {
      courses: {
        include: {
          subscriptions: {
            include: {
              user: { select: { id: true, fullName: true, email: true } },
            },
          },
          certificates: true,
          lessons: {
            include: { attendance: true },
          },
        },
      },
    },
  });
  if (!workspace) redirect("/teacher");

  return (
    <AppShell active="teacher-group">
      <h2 style={{ marginBottom: 8 }}>O&apos;quvchilar</h2>
      <p className="muted small" style={{ marginBottom: 16 }}>
        Avval kurs, keyin odam. Bir nechta kurs aralashmaydi. Sertifikat shu kursga tegishli.
      </p>
      {workspace.courses.length === 0 ? (
        <p className="muted">Avval Rejada dars qo&apos;shing. O&apos;quvchilar obuna bo&apos;lgach ro&apos;yxat to&apos;ladi.</p>
      ) : null}
      {workspace.courses.map((course) => {
        const active = course.subscriptions.filter((s) => isSubscriptionActive(s.endsAt));
        const attendedSum = active.reduce((n, s) => {
          return n + course.lessons.filter((l) => l.attendance.some((a) => a.userId === s.userId)).length;
        }, 0);
        const attendPct =
          active.length && course.lessons.length
            ? Math.round((attendedSum / (active.length * course.lessons.length)) * 100)
            : 0;
        return (
          <div key={course.id} style={{ marginBottom: 28 }}>
            <h3 style={{ marginBottom: 8 }}>{course.titleUz}</h3>
            <div className="studio-kpis" style={{ marginBottom: 16 }}>
              <div className="studio-kpi">
                <span className="small muted">O&apos;quvchi</span>
                <b>{active.length}</b>
              </div>
              <div className="studio-kpi">
                <span className="small muted">1 / 2 / 3-tarif</span>
                <b>
                  {active.filter((s) => s.tier === "t1").length} / {active.filter((s) => s.tier === "t2").length} /{" "}
                  {active.filter((s) => s.tier === "t3").length}
                </b>
              </div>
              <div className="studio-kpi">
                <span className="small muted">O&apos;rtacha davomat</span>
                <b>{course.lessons.length ? `${attendPct}%` : "—"}</b>
              </div>
            </div>
            {active.length === 0 ? (
              <p className="muted small">Bu kursda faol o&apos;quvchi yo&apos;q.</p>
            ) : (
              TIERS.map((tier) => {
                const students = active.filter((s) => s.tier === tier);
                if (students.length === 0) return null;
                return (
                  <div key={tier} style={{ marginBottom: 16 }}>
                    <div className="row gap-8" style={{ marginBottom: 8 }}>
                      <span className="badge accent">{TARIFF_LABELS[tier]}</span>
                      <span className="small muted">{TIER_NOTES[tier]} · {students.length} ta</span>
                    </div>
                    <div className="admin-table-wrap card" style={{ padding: 0 }}>
                      <table>
                        <thead>
                          <tr>
                            <th>O&apos;quvchi</th>
                            <th>Davomat</th>
                            <th>Sertifikat</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((s) => {
                            const seen = course.lessons.filter((l) =>
                              l.attendance.some((a) => a.userId === s.userId),
                            );
                            const attended = seen.length;
                            const pct = course.lessons.length
                              ? Math.round((attended / course.lessons.length) * 100)
                              : 0;
                            const hasCert = course.certificates.some((c) => c.userId === s.userId);
                            return (
                              <tr key={s.id}>
                                <td>
                                  {s.user.fullName}
                                  <div className="small muted">{s.user.email}</div>
                                </td>
                                <td>
                                  {attended}/{course.lessons.length} ({pct}%)
                                  <div className="small muted">
                                    {seen.length
                                      ? `${seen.slice(0, 3).map((l) => l.titleUz).join(" · ")}${seen.length > 3 ? ` · +${seen.length - 3}` : ""}`
                                      : "Hali mavzu ochilmagan"}
                                  </div>
                                  <div className="small muted">gacha {formatDateTime(s.endsAt)}</div>
                                </td>
                                <td>
                                  <div className="small muted" style={{ marginBottom: 6 }}>{course.titleUz}</div>
                                  {tier === "t1" ? (
                                    <span className="small muted">Yozuv tarifi</span>
                                  ) : hasCert ? (
                                    <span className="badge success">Berilgan</span>
                                  ) : (
                                    <IssueCertificateButton courseId={course.id} userId={s.userId} />
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        );
      })}
    </AppShell>
  );
}
