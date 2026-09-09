import { prisma } from "@/lib/prisma";
import { fmt } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [users, teachers, courses, payments, liveLessons] = await Promise.all([
    prisma.user.count(),
    prisma.teacher.count(),
    prisma.course.count(),
    prisma.payment.count(),
    prisma.lesson.count({ where: { status: "live" } }),
  ]);

  return (
    <>
      <h2 style={{ marginBottom: 18 }}>Admin kabineti</h2>
      <div className="kpi-grid">
        <div className="stat-card">
          <div className="small muted">Foydalanuvchilar</div>
          <div className="num">{fmt(users)}</div>
        </div>
        <div className="stat-card">
          <div className="small muted">O&apos;qituvchilar</div>
          <div className="num">{fmt(teachers)}</div>
        </div>
        <div className="stat-card">
          <div className="small muted">Kurslar</div>
          <div className="num">{fmt(courses)}</div>
        </div>
        <div className="stat-card">
          <div className="small muted">To&apos;lovlar (demo)</div>
          <div className="num">{fmt(payments)}</div>
        </div>
        <div className="stat-card">
          <div className="small muted">Jonli efirlar</div>
          <div className="num">{fmt(liveLessons)}</div>
        </div>
      </div>
    </>
  );
}
