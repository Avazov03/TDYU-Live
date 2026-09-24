import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLessonAccess } from "@/lib/access";
import { lessonFileMime, lessonUploadPath } from "@/lib/lesson-file";
import { isAdminRole, isTeacherRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

/**
 * Lesson material download — Enrollment/legacy access gated (Phase 2.6).
 * Filename maps to LessonAsset.fileUrl.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ filename: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Kirish kerak" }, { status: 401 });
  }

  const { filename } = await params;
  const filePath = lessonUploadPath(filename);
  if (!filePath) {
    return NextResponse.json({ error: "Fayl topilmadi" }, { status: 404 });
  }

  const fileUrl = `/uploads/lessons/${filename}`;
  const asset = await prisma.lessonAsset.findFirst({
    where: { fileUrl },
    include: {
      lesson: {
        include: { course: { include: { teacher: true } } },
      },
    },
  });
  if (!asset) {
    return NextResponse.json({ error: "Fayl topilmadi" }, { status: 404 });
  }

  const lesson = asset.lesson;
  const staff =
    isAdminRole(session.user.role) ||
    (isTeacherRole(session.user.role) && lesson.course.teacher.userId === session.user.id);

  if (!staff) {
    const access = await getLessonAccess(session.user.id, lesson.courseId, lesson.status);
    if (!access.ok) {
      return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
    }
  }

  let fileStat;
  try {
    fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error("not file");
  } catch {
    return NextResponse.json({ error: "Fayl topilmadi" }, { status: 404 });
  }

  const stream = createReadStream(filePath);
  const web = Readable.toWeb(stream) as ReadableStream;
  return new NextResponse(web, {
    headers: {
      "Content-Type": lessonFileMime(filename),
      "Content-Length": String(fileStat.size),
      "Cache-Control": "private, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
