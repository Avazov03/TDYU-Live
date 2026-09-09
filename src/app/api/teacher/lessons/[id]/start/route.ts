import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLiveStream } from "@/lib/mux";
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

  let stream;
  try {
    stream = await createLiveStream(lesson.titleUz);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Mux xatosi";
    if (message === "MUX_FREE_PLAN") {
      return NextResponse.json(
        {
          error:
            "Mux hisobi bepul tarifda — jonli efir yo'q. dashboard.mux.com → Billing: karta qo'shing, Video Live yoqiladi. Keyin shu tugmani qayta bosing.",
          code: "mux_free_plan",
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
  const updated = await prisma.lesson.update({
    where: { id: lesson.id },
    data: {
      status: "live",
      muxLiveStreamId: stream.liveStreamId,
      muxLivePlaybackId: stream.livePlaybackId,
      streamKey: stream.streamKey,
    },
  });

  await notifyCourseStudents(
    lesson.courseId,
    {
      type: "lesson_live",
      titleUz: "Dars boshlandi!",
      messageUz: `${lesson.course.titleUz}: ${lesson.titleUz}`,
      relatedId: lesson.id,
    },
    "t2",
  );

  return NextResponse.json({
    lesson: updated,
    demo: stream.demo,
    rtmpUrl: stream.demo ? null : "rtmps://global-live.mux.com:443/app",
  });
}
