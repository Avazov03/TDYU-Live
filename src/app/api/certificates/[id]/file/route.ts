import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canViewCertificate, isValidCertificateFileKey } from "@/lib/certificate-policy";
import { readCertificateFile } from "@/lib/certificate-storage";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Kirish kerak" }, { status: 401 });

  const { id } = await params;
  const cert = await prisma.certificate.findUnique({
    where: { id },
    select: {
      userId: true,
      fileKey: true,
      fileName: true,
      fileMime: true,
      revokedAt: true,
      course: { select: { teacher: { select: { userId: true } } } },
    },
  });
  const allowed =
    cert &&
    canViewCertificate({
      viewerId: session.user.id,
      ownerId: cert.userId,
      isAdmin: isAdminRole(session.user.role),
      isCourseTeacher: cert.course.teacher.userId === session.user.id,
      revoked: Boolean(cert.revokedAt),
    });
  if (!cert || !allowed || !isValidCertificateFileKey(cert.fileKey)) {
    return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
  }

  const data = await readCertificateFile(cert.fileKey).catch(() => null);
  if (!data) return NextResponse.json({ error: "Fayl topilmadi" }, { status: 404 });

  const download = new URL(req.url).searchParams.get("download") === "1";
  const name = encodeURIComponent(cert.fileName || "sertifikat");
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": cert.fileMime || "application/octet-stream",
      "Content-Length": String(data.byteLength),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${name}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
