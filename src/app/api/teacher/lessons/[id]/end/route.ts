import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { completeLiveStream } from "@/lib/mux";
import { closeLiveRoom } from "@/lib/live-rooms";
import { notifyCourseStudents } from "@/lib/notify";
import { getTeacherForUser } from "@/lib/teacher";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }
  const teacher = await getTeacherForUser(session.user.id);
  if (!teacher) return NextResponse.json({ error: "Profil yo'q" }, { status: 404 });

  const { id } = await params;
  const lesson = await prisma.lesson.findFirst({
    where: { id, course: { teacherId: teacher.id } },
    include: { course: true },
  });
  if (!lesson) return NextResponse.json({ error: "Dars topilmadi" }, { status: 404 });

  if (lesson.muxLiveStreamId) {
    await completeLiveStream(lesson.muxLiveStreamId);
  }
  closeLiveRoom(lesson.id);

  const updated = await prisma.lesson.update({
    where: { id: lesson.id },
    data: {
      status: "ended",
      muxVodPlaybackId: lesson.muxVodPlaybackId ?? lesson.muxLivePlaybackId,
    },
  });

  await notifyCourseStudents(lesson.courseId, {
    type: "lesson_live",
    titleUz: "Yozuv tayyor",
    messageUz: `${lesson.course.titleUz}: ${lesson.titleUz} yozuvi ochildi.`,
    relatedId: lesson.id,
  });

  return NextResponse.json({ lesson: updated });
}
