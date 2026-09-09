import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLiveStreamOrDemo } from "@/lib/mux";
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
  if (lesson.status === "live") {
    const demo = Boolean(lesson.streamKey?.startsWith("demo_"));
    return NextResponse.json({
      lesson,
      demo,
      rtmpUrl: demo ? null : "rtmps://global-live.mux.com:443/app",
    });
  }

  const stream = await createLiveStreamOrDemo(lesson.titleUz);
  const updated = await prisma.lesson.update({
    where: { id: lesson.id },
    data: {
      status: "live",
      muxLiveStreamId: stream.liveStreamId,
      muxLivePlaybackId: stream.livePlaybackId,
      streamKey: stream.streamKey,
    },
  });

  await notifyCourseStudents(lesson.courseId, {
    type: "lesson_live",
    titleUz: "Dars boshlandi!",
    messageUz: `${lesson.course.titleUz}: ${lesson.titleUz}`,
    relatedId: lesson.id,
  });

  return NextResponse.json({
    lesson: updated,
    demo: stream.demo,
    rtmpUrl: stream.demo ? null : "rtmps://global-live.mux.com:443/app",
  });
}
