import { AppShell } from "@/components/layout/AppShell";
import { SubmitForm } from "@/components/assignment/SubmitForm";
import { getActiveSubscriptions, requireStudentCabinet } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { isPriorityTier } from "@/lib/tariffs";

export const dynamic = "force-dynamic";

export default async function AssignmentsPage() {
  const { user } = await requireStudentCabinet("/assignments");
  const subs = await getActiveSubscriptions(user.id);
  const courseIds = subs.map((s) => s.course.id);
  const priority = subs.some((s) => isPriorityTier(s.tier));

  const items = await prisma.assignment.findMany({
    where: { courseId: { in: courseIds } },
    include: {
      course: { include: { teacher: { select: { id: true, fullName: true } } } },
      submissions: { where: { userId: user.id } },
    },
    orderBy: { dueAt: "asc" },
  });

  const byTeacher = new Map<string, { name: string; courses: Map<string, { id: string; title: string; items: typeof items }> }>();
  for (const item of items) {
    const teacher = byTeacher.get(item.course.teacher.id) ?? {
      name: item.course.teacher.fullName,
      courses: new Map(),
    };
    const course = teacher.courses.get(item.courseId) ?? { id: item.courseId, title: item.course.titleUz, items: [] };
    course.items.push(item);
    teacher.courses.set(item.courseId, course);
    byTeacher.set(item.course.teacher.id, teacher);
  }

  return (
    <AppShell active="assignments">
      <div className="lx-board">
        <p className="lx-kicker">Topshiriqlar</p>
        <h2>Kimdan va qaysi kursdan</h2>
        <p className="muted small lx-lead">
          O&apos;qituvchi, keyin kurs. Holat har bir vazifaning o&apos;zida.
        </p>
        {priority ? (
          <p className="small muted" style={{ marginTop: -8 }}>3-tarifdagi ishingiz o&apos;qituvchida birinchi navbatda.</p>
        ) : null}
        {items.length === 0 ? <div className="empty">Faol kurslaringizda topshiriq yo&apos;q.</div> : null}
        {[...byTeacher.entries()].map(([id, teacher]) => (
          <section key={id} className="lx-group">
            <h3>{teacher.name}</h3>
            {[...teacher.courses.values()].map((course) => (
              <div key={course.id} style={{ marginBottom: 16 }}>
                <p className="lx-kicker">{course.title}</p>
                <div className="lx-stack">
                  {course.items.map((item) => {
                    const sent = item.submissions[0];
                    const late = !sent && item.dueAt < new Date();
                    return (
                      <article key={item.id} className="lx-row">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h3>{item.titleUz}</h3>
                          <p className="small muted" style={{ margin: 0 }}>Muddat: {formatDateTime(item.dueAt)}</p>
                          <p style={{ margin: "10px 0" }}>{item.descriptionUz}</p>
                          {sent ? (
                            <div>
                              <span className="badge success">{sent.grade != null ? `Baho: ${sent.grade}` : "Topshirilgan"}</span>
                              {sent.grade == null ? <p className="small muted">Tekshiruv kutilmoqda</p> : null}
                              {sent.teacherNote ? <p className="small">{sent.teacherNote}</p> : null}
                            </div>
                          ) : (
                            <div>
                              <span className={`badge ${late ? "danger" : "pending"}`}>{late ? "Kechikkan" : "Ochiq"}</span>
                              <div style={{ marginTop: 10 }}>
                                <SubmitForm assignmentId={item.id} />
                              </div>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </AppShell>
  );
}
