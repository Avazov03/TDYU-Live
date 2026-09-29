import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShellNarrow } from "@/components/layout/AppShell";
import { auth } from "@/lib/auth";
import { canViewCertificate } from "@/lib/certificate-policy";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { isAdminRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const cert = await prisma.certificate.findUnique({
    where: { id },
    include: {
      user: { select: { fullName: true, id: true } },
      course: { include: { teacher: { select: { fullName: true, userId: true } } } },
    },
  });
  if (!cert) notFound();
  const allowed = canViewCertificate({
    viewerId: session.user.id,
    ownerId: cert.userId,
    isAdmin: isAdminRole(session.user.role),
    isCourseTeacher: cert.course.teacher.userId === session.user.id,
    revoked: Boolean(cert.revokedAt),
  });
  if (!allowed) redirect("/certificates");

  const fileUrl = `/api/certificates/${cert.id}/file`;
  const isPdf = cert.fileMime === "application/pdf";

  return (
    <AppShellNarrow active="certificates">
      <div className="lx-cert-view" data-testid="certificate-view">
        <header className="lx-mc-head">
          <div>
            <p className="lx-kicker">Sertifikat</p>
            <h1 className="lx-mc-title">{cert.course.titleUz}</h1>
            <p className="lx-mc-sub">
              {cert.user.fullName} · o‘qituvchi {cert.course.teacher.fullName} · {formatDateTime(cert.issuedAt)}
            </p>
          </div>
        </header>

        {cert.revokedAt ? (
          <p className="lx-cert-revoked" role="status" data-testid="certificate-revoked">
            Bekor qilingan: {formatDateTime(cert.revokedAt)}
            {cert.revokeReason ? ` — ${cert.revokeReason}` : ""}
          </p>
        ) : null}

        {cert.fileKey ? (
          <>
            {isPdf ? (
              <iframe className="lx-cert-frame" src={fileUrl} title={`Sertifikat — ${cert.course.titleUz}`} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- private, auth-gated file; not optimizable
              <img className="lx-cert-frame is-img" src={fileUrl} alt={`Sertifikat — ${cert.course.titleUz}`} />
            )}
            <div className="lx-cert-actions">
              <a className="btn btn-primary" href={`${fileUrl}?download=1`} data-testid="certificate-download">
                Yuklab olish
              </a>
              <Link className="btn" href="/certificates">
                Barcha sertifikatlar
              </Link>
            </div>
          </>
        ) : (
          <div className="lx-mc-empty" data-testid="certificate-no-file">
            <h2>Sertifikat fayli yuklanmagan</h2>
            <p>Bu sertifikat fayl yuklash joriy etilishidan oldin berilgan. O‘qituvchi faylni qayta yuklashi mumkin.</p>
          </div>
        )}
      </div>
    </AppShellNarrow>
  );
}
