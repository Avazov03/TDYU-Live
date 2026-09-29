import Link from "next/link";
import { RoleAvatar } from "@/components/admin/RoleAvatar";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { viewerCanSeeCredentials } from "@/lib/super-admin";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminCertificatesPage() {
  const session = await auth();
  const canSeeSecrets = await viewerCanSeeCredentials(session?.user?.id, session?.user?.role);

  const certs = await prisma.certificate.findMany({
    orderBy: { issuedAt: "desc" },
    take: 500,
    include: {
      user: { select: { fullName: true, email: true } },
      course: { select: { titleUz: true, teacher: { select: { fullName: true } } } },
    },
  });
  const actorIds = [...new Set(certs.flatMap((c) => [c.issuedBy, c.revokedBy]).filter((x): x is string => Boolean(x)))];
  const actors = new Map(
    (await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, fullName: true } })).map((u) => [
      u.id,
      u.fullName,
    ]),
  );
  const active = certs.filter((c) => !c.revokedAt).length;

  return (
    <div className="admin-board">
      <header className="lx-mc-head lx-admin-head">
        <div>
          <p className="lx-kicker">Sertifikatlar</p>
          <h1 className="lx-mc-title">Sertifikatlar tarixi</h1>
          <p className="lx-mc-sub">
            O‘qituvchilar bergan va bekor qilgan sertifikatlar · {active} ta faol, {certs.length - active} ta bekor
            qilingan
          </p>
        </div>
      </header>

      <div className="admin-table-wrap card" style={{ padding: 0 }}>
        <table className="staff-table" data-testid="admin-certificates">
          <thead>
            <tr>
              <th>O&apos;quvchi</th>
              <th>Kurs</th>
              <th>Berdi</th>
              <th>Holat</th>
              <th>Fayl</th>
            </tr>
          </thead>
          <tbody>
            {certs.map((c) => (
              <tr key={c.id} style={{ cursor: "default" }}>
                <td>
                  <div className="staff-name">
                    <RoleAvatar name={c.user.fullName} role="student" />
                    <span>
                      {c.user.fullName}
                      {canSeeSecrets ? <div className="small muted">{c.user.email}</div> : null}
                    </span>
                  </div>
                </td>
                <td className="lx-pay-course">
                  {c.course.titleUz}
                  <div className="small muted">{c.course.teacher.fullName}</div>
                </td>
                <td className="small muted lx-pay-nowrap">
                  {(c.issuedBy && actors.get(c.issuedBy)) || "—"}
                  <div>{formatDateTime(c.issuedAt)}</div>
                </td>
                <td>
                  {c.revokedAt ? (
                    <>
                      <span className="badge danger">Bekor qilingan</span>
                      <div className="small muted">
                        {(c.revokedBy && actors.get(c.revokedBy)) || "—"} · {formatDateTime(c.revokedAt)}
                      </div>
                      {c.revokeReason ? <div className="small">{c.revokeReason}</div> : null}
                    </>
                  ) : (
                    <span className="badge success">Faol</span>
                  )}
                </td>
                <td className="lx-pay-nowrap">
                  {c.fileKey ? (
                    <Link href={`/certificates/${c.id}`} className="btn btn-sm">
                      Ko‘rish
                    </Link>
                  ) : (
                    <span className="small muted">Fayl yo‘q</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {certs.length === 0 ? <div className="empty">Hali sertifikat berilmagan.</div> : null}
      </div>
    </div>
  );
}
