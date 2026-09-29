import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getStudentOwnedCourses } from "@/lib/access";
import { writeAuditLog } from "@/lib/audit-log";
import {
  buildCertificateFileKey,
  checkCertificateFile,
  isCourseFinishedForCertificate,
} from "@/lib/certificate-policy";
import { removeCertificateFile, saveCertificateFile } from "@/lib/certificate-storage";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import { getTeacherForUser } from "@/lib/teacher";
import { isUniqueConstraint } from "@/lib/prisma-error";

const schema = z.object({
  courseId: z.string().trim().min(1).max(64),
  userId: z.string().trim().min(1).max(64),
});

/** Multipart: courseId, userId, file (PDF/JPG/PNG ≤ 10 MB). Only after the course is finished. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }
  const teacher = await getTeacherForUser(session.user.id);
  if (!teacher) return NextResponse.json({ error: "Profil yo'q" }, { status: 404 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Noto'g'ri ma'lumot" }, { status: 400 });
  const parsed = schema.safeParse({ courseId: form.get("courseId"), userId: form.get("userId") });
  if (!parsed.success) return NextResponse.json({ error: "Noto'g'ri ma'lumot" }, { status: 400 });

  const course = await prisma.course.findFirst({
    where: { id: parsed.data.courseId, teacherId: teacher.id },
    select: { id: true, titleUz: true, lifecycleStatus: true, lessons: { select: { status: true } } },
  });
  if (!course) return NextResponse.json({ error: "Kurs topilmadi" }, { status: 404 });

  if (
    !isCourseFinishedForCertificate({
      lifecycleStatus: course.lifecycleStatus,
      lessonStatuses: course.lessons.map((l) => l.status),
    })
  ) {
    return NextResponse.json(
      { error: "Sertifikat kurs yakunlangach beriladi", code: "COURSE_NOT_FINISHED" },
      { status: 409 },
    );
  }

  const owned = await getStudentOwnedCourses(parsed.data.userId);
  if (!owned.some((row) => row.courseId === course.id)) {
    return NextResponse.json(
      { error: "Bu o‘quvchi kursga yozilmagan", code: "NOT_ENROLLED" },
      { status: 409 },
    );
  }

  const file = form.get("file");
  const data = file instanceof File ? new Uint8Array(await file.arrayBuffer()) : new Uint8Array();
  const fileCheck = checkCertificateFile({ size: data.byteLength, head: data.subarray(0, 16) });
  if (!fileCheck.ok) return NextResponse.json({ error: fileCheck.message, code: fileCheck.code }, { status: 422 });
  const originalName = (file instanceof File ? file.name : "").trim().slice(0, 200) || `sertifikat.${fileCheck.kind.ext}`;

  const where = { userId_courseId: { userId: parsed.data.userId, courseId: course.id } };
  const existing = await prisma.certificate.findUnique({ where });
  if (existing && !existing.revokedAt) {
    return NextResponse.json({ error: "Sertifikat allaqachon berilgan", code: "ALREADY_ISSUED" }, { status: 409 });
  }

  const certificateId = existing?.id ?? crypto.randomUUID();
  const fileKey = buildCertificateFileKey({ courseId: course.id, certificateId, ext: fileCheck.kind.ext });
  await saveCertificateFile(fileKey, data);

  const fileData = {
    fileKey,
    fileName: originalName,
    fileMime: fileCheck.kind.mime,
    fileSize: data.byteLength,
    issuedBy: session.user.id,
  };

  let cert;
  try {
    if (existing) {
      const reissued = await prisma.certificate.updateMany({
        where: { id: existing.id, revokedAt: { not: null } },
        data: { ...fileData, issuedAt: new Date(), revokedAt: null, revokedBy: null, revokeReason: null },
      });
      if (reissued.count !== 1) {
        await removeCertificateFile(fileKey);
        return NextResponse.json({ error: "Sertifikat allaqachon berilgan", code: "ALREADY_ISSUED" }, { status: 409 });
      }
      cert = await prisma.certificate.findUniqueOrThrow({ where: { id: existing.id } });
    } else {
      cert = await prisma.certificate.create({
        data: { id: certificateId, userId: parsed.data.userId, courseId: course.id, ...fileData },
      });
    }
  } catch (err) {
    await removeCertificateFile(fileKey);
    if (!isUniqueConstraint(err)) throw err;
    return NextResponse.json({ error: "Sertifikat allaqachon berilgan", code: "ALREADY_ISSUED" }, { status: 409 });
  }

  if (existing?.fileKey && existing.fileKey !== fileKey) {
    await removeCertificateFile(existing.fileKey).catch(() => undefined);
  }

  await writeAuditLog({
    actorId: session.user.id,
    action: existing ? "certificate.reissue" : "certificate.issue",
    entityType: "certificate",
    entityId: cert.id,
    metadata: { courseId: course.id, userId: parsed.data.userId, fileName: originalName, fileSize: data.byteLength },
  });

  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (user) {
    await notifyUser({
      userId: user.id,
      type: "certificate",
      titleUz: "Sertifikat berildi",
      messageUz: course.titleUz,
      relatedId: cert.id,
      email: user.email,
      telegramChatId: user.telegramChatId,
    });
  }

  return NextResponse.json({ certificate: { id: cert.id, issuedAt: cert.issuedAt } });
}
