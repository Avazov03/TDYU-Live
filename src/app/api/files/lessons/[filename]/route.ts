import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLessonAccess } from "@/lib/access";
import { lessonUploadPath, streamUploadFile } from "@/lib/lesson-file";
import { isAdminRole, isTeacherRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

/**
 * Lesson material download. Public URL `/uploads/lessons/:filename` is rewritten here by
 * middleware so build-time files under public/ are never served statically.
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

  const asset = await prisma.lessonAsset.findFirst({
    where: { fileUrl: `/uploads/lessons/${filename}` },
    include: { lesson: { include: { course: { include: { teacher: true } } } } },
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

  return streamUploadFile(filePath, filename);
}
