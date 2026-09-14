import { AppShell } from "@/components/layout/AppShell";
import { requireAppUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { dayTitle, localDayKey } from "@/lib/plan";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const { user } = await requireAppUser("/history");

  const items = await prisma.attendance.findMany({
    where: { userId: user.id },
    include: {
      lesson: {
        include: {
          course: { include: { teacher: { select: { fullName: true } } } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
    take: 50,
  });

  const byDay = new Map<string, typeof items>();
  for (const item of items) {
    const key = localDayKey(item.joinedAt);
    const list = byDay.get(key) ?? [];
    list.push(item);
    byDay.set(key, list);
  }

  return (
    <AppShell active="history">
      <div className="lx-board">
        <p className="lx-kicker">Ko&apos;rilganlar</p>
        <h2>Ochgan darslaringiz</h2>
        <p className="muted small lx-lead">Siz kirgan mavzular, kun bo&apos;yicha.</p>
        {items.length === 0 ? <div className="empty">Hali dars ochilmagan.</div> : null}
        {[...byDay.entries()].map(([key, rows]) => (
          <section key={key} className="lx-group">
            <h3>{dayTitle(rows[0]?.joinedAt ?? new Date(key))}</h3>
            <div className="lx-stack">
              {rows.map((row) => (
                <Link key={row.id} href={`/learn/${row.lesson.id}`} className="lx-row">
                  <div>
                    <p className="lx-kicker">{row.lesson.course.teacher.fullName} · {formatDateTime(row.joinedAt)}</p>
                    <h3>{row.lesson.titleUz}</h3>
                    <p className="small muted" style={{ margin: 0 }}>{row.lesson.course.titleUz}</p>
                  </div>
                  <span className="lx-go">Ochish</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
