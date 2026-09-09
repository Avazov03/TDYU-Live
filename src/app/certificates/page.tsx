import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { requireStudentCabinet } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

function thumbTone(id: string) {
  const n = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return `tone-${(n % 6) + 1}`;
}

export default async function CertificatesPage() {
  const { user } = await requireStudentCabinet("/certificates");

  const items = await prisma.certificate.findMany({
    where: { userId: user.id },
    include: { course: { select: { titleUz: true } } },
    orderBy: { issuedAt: "desc" },
  });

  return (
    <AppShell active="certificates">
      <h2 style={{ marginBottom: 16 }}>Sertifikatlar</h2>
      {items.length === 0 ? (
        <div className="empty">Hali sertifikat yo&apos;q.</div>
      ) : (
        <div className="grid">
          {items.map((c) => (
            <Link key={c.id} href={`/certificates/${c.id}`} className="vcard">
              <div className={`thumb course-thumb ${thumbTone(c.id)}`}>
                <span className="thumb-play" aria-hidden>▶</span>
                <span className="dur">PDF</span>
              </div>
              <div className="vmeta">
                <div className="vinfo">
                  <h3>{c.course.titleUz}</h3>
                  <p>{formatDateTime(c.issuedAt)}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
