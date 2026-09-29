import Link from "next/link";
import { Award } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { requireStudentCabinet } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { UZ_MONTHS_LONG, initials, tashkentParts } from "@/lib/utils";

export const dynamic = "force-dynamic";

function issuedLabel(date: Date) {
  const p = tashkentParts(date);
  return `${Number(p.day)}-${UZ_MONTHS_LONG[p.monthIndex]}, ${p.year}`;
}

export default async function CertificatesPage() {
  const { user } = await requireStudentCabinet("/certificates");

  const items = await prisma.certificate.findMany({
    where: { userId: user.id },
    include: {
      course: {
        include: { teacher: { select: { fullName: true } }, subject: { select: { nameUz: true } } },
      },
    },
    orderBy: { issuedAt: "desc" },
  });

  return (
    <AppShell active="certificates">
      <div className="lx-sc">
        <header className="lx-mc-head">
          <div>
            <p className="lx-kicker">Sertifikatlar</p>
            <h1 className="lx-mc-title">Sertifikatlar</h1>
            {items.length > 0 ? (
              <p className="lx-mc-sub">{items.length} ta sertifikat · chop etish yoki saqlash uchun oching</p>
            ) : null}
          </div>
        </header>

        {items.length === 0 ? (
          <div className="lx-mc-empty">
            <h2>Hali sertifikat yo‘q</h2>
            <p>Kurs yakunlangach, o‘qituvchi sertifikat beradi — u shu yerda paydo bo‘ladi.</p>
            <Link href="/my-courses" className="btn btn-primary">
              Kurslarim
            </Link>
          </div>
        ) : (
          <div className="lx-course-grid">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/certificates/${item.id}`}
                className="lx-ccard lx-cert"
                data-testid="certificate-card"
              >
                <div className="lx-cert-top">
                  <span className="lx-cert-icon" aria-hidden>
                    <Award size={22} strokeWidth={2} />
                  </span>
                  <span className="lx-cert-date">{issuedLabel(item.issuedAt)}</span>
                </div>
                <div className="lx-ccard-body">
                  <p className="lx-ccard-subject">{item.course.subject.nameUz}</p>
                  <h3 className="lx-ccard-title">{item.course.titleUz}</h3>
                  <div className="lx-ccard-teacher">
                    <span className="avatar sm" aria-hidden>
                      {initials(item.course.teacher.fullName)}
                    </span>
                    <span>{item.course.teacher.fullName}</span>
                  </div>
                </div>
                <div className="lx-ccard-foot">
                  <span />
                  <span className="lx-ccard-go">
                    Ko‘rish va chop etish <span aria-hidden>→</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
