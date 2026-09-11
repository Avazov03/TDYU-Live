import { notFound, redirect } from "next/navigation";
import { AppShellNarrow } from "@/components/layout/AppShell";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { PrintButton } from "@/components/certificate/PrintButton";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function CertificatePrintPage({
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
      course: { include: { teacher: { select: { fullName: true } } } },
    },
  });
  if (!cert) notFound();
  if (cert.userId !== session.user.id && session.user.role !== "admin" && session.user.role !== "teacher") {
    redirect("/certificates");
  }

  return (
    <AppShellNarrow active="certificates">
      <div className="certificate">
        <div className="small muted">{BRAND.name.toUpperCase()}</div>
        <h1>Sertifikat</h1>
        <p>
          Ushbu hujjat <b>{cert.user.fullName}</b> ning{" "}
          <b>{cert.course.titleUz}</b> kursini muvaffaqiyatli yakunlaganini tasdiqlaydi.
        </p>
        <p className="small muted">
          O&apos;qituvchi: {cert.course.teacher.fullName} · {formatDateTime(cert.issuedAt)}
        </p>
        <p className="small muted">ID: {cert.id}</p>
        <PrintButton />
      </div>
    </AppShellNarrow>
  );
}
