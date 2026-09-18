import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyGuide } from "@/components/cabinet/EmptyGuide";
import { requireStudentCabinet } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CertificatesPage() {
  const { user } = await requireStudentCabinet("/certificates");

  const items = await prisma.certificate.findMany({
    where: { userId: user.id },
    include: { course: { include: { teacher: { select: { id: true, fullName: true } } } } },
    orderBy: { issuedAt: "desc" },
  });

  const groups = new Map<string, { name: string; items: typeof items }>();
  for (const item of items) {
    const key = item.course.teacher.id;
    const group = groups.get(key) ?? { name: item.course.teacher.fullName, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }

  return (
    <AppShell active="certificates">
      <div className="lx-board">
        <p className="lx-kicker">Sertifikatlar</p>
        <h2>Qaysi o&apos;qituvchi, qaysi kurs</h2>
        <p className="muted small lx-lead">Chop etish yoki saqlash uchun oching.</p>
        {items.length === 0 ? (
          <EmptyGuide
            title="Hali sertifikat yo‘q"
            text="Kursni tugatib (darslar + topshiriqlar), o‘qituvchi bersa shu yerda chiqadi. Hozir Bugun yoki Kurslarimdan davom eting."
            href="/app"
            cta="Bugunga"
          />
        ) : null}
        {[...groups.entries()].map(([id, group]) => (
          <section key={id} className="lx-group">
            <h3>{group.name}</h3>
            <div className="lx-stack">
              {group.items.map((item) => (
                <Link key={item.id} href={`/certificates/${item.id}`} className="lx-row">
                  <div>
                    <p className="lx-kicker">{formatDateTime(item.issuedAt)}</p>
                    <h3>{item.course.titleUz}</h3>
                    <p className="small muted" style={{ margin: 0 }}>Chop etish</p>
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
