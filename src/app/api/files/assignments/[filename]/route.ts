import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assignmentUploadPath, streamUploadFile } from "@/lib/lesson-file";
import { isAdminRole, isTeacherRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

/**
 * Assignment submission download (`/uploads/assignments/:filename`, rewritten by middleware).
 * Only the submitting student, the course teacher and admins may read it.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ filename: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Kirish kerak" }, { status: 401 });
  }

  const { filename } = await params;
  const filePath = assignmentUploadPath(filename);
  if (!filePath) {
    return NextResponse.json({ error: "Fayl topilmadi" }, { status: 404 });
  }

  const submission = await prisma.submission.findFirst({
    where: { fileUrl: `/uploads/assignments/${filename}` },
    select: {
      userId: true,
      assignment: { select: { course: { select: { teacher: { select: { userId: true } } } } } },
    },
  });
  if (!submission) {
    return NextResponse.json({ error: "Fayl topilmadi" }, { status: 404 });
  }

  const allowed =
    submission.userId === session.user.id ||
    isAdminRole(session.user.role) ||
    (isTeacherRole(session.user.role) &&
      submission.assignment.course.teacher.userId === session.user.id);
  if (!allowed) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }

  return streamUploadFile(filePath, filename);
}
