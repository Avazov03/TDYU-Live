import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { completeLiveStream } from "@/lib/mux";
import { closeLiveRoom } from "@/lib/live-rooms";
import { notifyCourseStudents } from "@/lib/notify";
import { getTeacherForUser } from "@/lib/teacher";
import { canTeacherEndLive, endLiveSession } from "@/lib/live-session";
import { isLiveWaitingRoomV2Enabled } from "@/lib/feature-flags";

const bodySchema = z
  .object({
    recordingUrl: z.string().trim().min(1).max(400).optional(),
  })
  .optional();

export async function POST(
  req: Request,
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

  if (lesson.status === "cancelled") {
    return NextResponse.json({ error: "Bekor qilingan dars" }, { status: 400 });
  }
  if (lesson.status === "ended") {
    return NextResponse.json({ lesson });
  }
  if (!canTeacherEndLive(lesson.status) && lesson.status !== "scheduled") {
    return NextResponse.json({ error: "Bu darsni yopib bo‘lmaydi" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  const recordingUrl = parsed.success ? parsed.data?.recordingUrl : undefined;

  if (lesson.muxLiveStreamId) {
    await completeLiveStream(lesson.muxLiveStreamId);
  }
  closeLiveRoom(lesson.id);

  const vodMux = lesson.muxVodPlaybackId ?? lesson.muxLivePlaybackId;
  const savedUrl = recordingUrl || lesson.recordingUrl || null;
  const hasRealVod = Boolean(savedUrl) || Boolean(vodMux && !vodMux.startsWith("demo_"));

  const updated = await prisma.lesson.update({
    where: { id: lesson.id },
    data: {
      status: "ended",
      recordingUrl: savedUrl,
      muxVodPlaybackId: vodMux,
    },
  });

  let liveSession = null;
  if (isLiveWaitingRoomV2Enabled()) {
    liveSession = await endLiveSession(lesson.id);
  }

  await notifyCourseStudents(lesson.courseId, {
    type: "lesson_live",
    titleUz: hasRealVod ? "Yozuv tayyor" : "Dars tugadi",
    messageUz: hasRealVod
      ? `${lesson.course.titleUz}: ${lesson.titleUz} yozuvi ochildi.`
      : `${lesson.course.titleUz}: ${lesson.titleUz} yakunlandi.`,
    relatedId: lesson.id,
  });

  return NextResponse.json({ lesson: updated, liveSession });
}
