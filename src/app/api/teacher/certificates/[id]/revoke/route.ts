import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit-log";
import { checkRevokeReason } from "@/lib/certificate-policy";
import { notifyUser } from "@/lib/notify";
import { prisma } from "@/lib/prisma";
import { getTeacherForUser } from "@/lib/teacher";

/** Course teacher revokes an issued certificate with a written reason; history stays for Admin. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }
  const teacher = await getTeacherForUser(session.user.id);
  if (!teacher) return NextResponse.json({ error: "Profil yo'q" }, { status: 404 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { reason?: unknown };
  const reason = checkRevokeReason(typeof body.reason === "string" ? body.reason : "");
  if (!reason.ok) return NextResponse.json({ error: reason.message, code: "VALIDATION" }, { status: 400 });

  const cert = await prisma.certificate.findUnique({
    where: { id },
    include: {
      course: { select: { teacherId: true, titleUz: true } },
      user: { select: { id: true, email: true, telegramChatId: true } },
    },
  });
  if (!cert || cert.course.teacherId !== teacher.id) {
    return NextResponse.json({ error: "Sertifikat topilmadi" }, { status: 404 });
  }

  const revokedAt = new Date();
  const updated = await prisma.certificate.updateMany({
    where: { id: cert.id, revokedAt: null },
    data: { revokedAt, revokedBy: session.user.id, revokeReason: reason.reason },
  });
  if (updated.count !== 1) {
    return NextResponse.json({ error: "Sertifikat allaqachon bekor qilingan", code: "ALREADY_REVOKED" }, { status: 409 });
  }

  await writeAuditLog({
    actorId: session.user.id,
    action: "certificate.revoke",
    entityType: "certificate",
    entityId: cert.id,
    metadata: { courseId: cert.courseId, userId: cert.userId, reason: reason.reason },
  });

  await notifyUser({
    userId: cert.user.id,
    type: "system",
    titleUz: "Sertifikat bekor qilindi",
    messageUz: `${cert.course.titleUz}: ${reason.reason}`,
    email: cert.user.email,
    telegramChatId: cert.user.telegramChatId,
  });

  return NextResponse.json({ ok: true, revokedAt });
}
