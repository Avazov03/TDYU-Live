import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { requireStudentCabinet } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { TARIFF_LABELS, isSubscriptionActive } from "@/lib/tariffs";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MyCoursesPage() {
  const { user } = await requireStudentCabinet("/my-courses");

  const subs = await prisma.subscription.findMany({
    where: { userId: user.id },
    include: {
      course: {
        include: {
          teacher: { select: { id: true, fullName: true } },
          subject: { select: { nameUz: true } },
          lessons: { where: { status: { in: ["live", "scheduled"] } }, orderBy: { scheduledAt: "asc" }, take: 1 },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const groups = new Map<string, { name: string; items: typeof subs }>();
  for (const sub of subs) {
    const key = sub.course.teacher.id;
    const group = groups.get(key) ?? { name: sub.course.teacher.fullName, items: [] };
    group.items.push(sub);
    groups.set(key, group);
  }

  return (
    <AppShell active="my-courses">
      <div className="lx-board">
        <p className="lx-kicker">Kurslarim</p>
        <h2>O&apos;qituvchi, keyin uning kurslari</h2>
        <p className="muted small lx-lead">
          Bir o&apos;qituvchining bir nechta kursi va turli o&apos;qituvchilar alohida.
        </p>
        {subs.length === 0 ? <div className="empty">Hali kurs yo&apos;q.</div> : null}
        {[...groups.entries()].map(([id, group]) => (
          <section key={id} className="lx-group">
            <h3>{group.name}</h3>
            <div className="lx-stack">
              {group.items.map((sub) => {
                const active = isSubscriptionActive(sub.endsAt);
                const next = sub.course.lessons[0];
                return (
                  <Link key={sub.id} href={`/courses/${sub.course.id}`} className="lx-row">
                    <div>
                      <p className="lx-kicker">{sub.course.subject.nameUz}</p>
                      <h3>{sub.course.titleUz}</h3>
                      <p className="small muted" style={{ margin: "0 0 8px" }}>
                        {next ? `Keyingi: ${next.titleUz} · ${formatDateTime(next.scheduledAt)}` : "Keyingi dars yo'q"}
                      </p>
                      <span className={`badge ${active ? "accent" : ""}`}>
                        {active ? TARIFF_LABELS[sub.tier] : "Muddati tugagan"}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
