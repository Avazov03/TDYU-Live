import { AppShell } from "@/components/layout/AppShell";
import { SubmitForm } from "@/components/assignment/SubmitForm";
import { requireStudentCabinet } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { isPriorityTier } from "@/lib/tariffs";

export const dynamic = "force-dynamic";

export default async function AssignmentsPage() {
  const { user, sub } = await requireStudentCabinet("/assignments");

  const items = await prisma.assignment.findMany({
    where: {
      course: {
        subscriptions: {
          some: { userId: user.id, endsAt: { gt: new Date() } },
        },
      },
    },
    include: {
      course: { select: { titleUz: true } },
      submissions: { where: { userId: user.id } },
    },
    orderBy: { dueAt: "asc" },
  });

  return (
    <AppShell active="assignments">
      <h2 style={{ marginBottom: 16 }}>Topshiriqlar</h2>
      {isPriorityTier(sub.tier) ? (
        <p className="small muted" style={{ marginTop: -8, marginBottom: 16 }}>
          3-tarif: ishingiz o&apos;qituvchida birinchi navbatda ko&apos;rinadi.
        </p>
      ) : null}
      {items.length === 0 ? (
        <div className="empty">Faol kurslaringizda topshiriq yo&apos;q.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {items.map((a) => {
            const sub = a.submissions[0];
            const tone = `tone-${(a.id.split("").reduce((n, c) => n + c.charCodeAt(0), 0) % 6) + 1}`;
            return (
              <div key={a.id} className="watch-rec-card" style={{ alignItems: "flex-start", display: "flex", gap: 12 }}>
                <div className={`rec-thumb course-thumb ${tone}`}>
                  <span className="thumb-play sm" aria-hidden>▶</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: 15, margin: "0 0 4px" }}>{a.titleUz}</h3>
                  <p className="small muted" style={{ margin: 0 }}>
                    {a.course.titleUz} · Muddat: {formatDateTime(a.dueAt)}
                  </p>
                  <p className="muted" style={{ margin: "10px 0" }}>{a.descriptionUz}</p>
                  {sub ? (
                    <div>
                      <span className="badge success">Topshirilgan</span>
                      {sub.grade != null ? (
                        <p style={{ marginTop: 8 }}>Baho: <b>{sub.grade}</b></p>
                      ) : (
                        <p className="small muted" style={{ marginTop: 8 }}>Tekshiruv kutilmoqda</p>
                      )}
                      {sub.teacherNote ? <p className="small">{sub.teacherNote}</p> : null}
                    </div>
                  ) : (
                    <SubmitForm assignmentId={a.id} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
