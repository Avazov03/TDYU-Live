import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyCourseStudents } from "@/lib/notify";

type MuxEvent = {
  type?: string;
  data?: {
    live_stream_id?: string;
    playback_ids?: { id: string }[];
    id?: string;
    passthrough?: string;
  };
};

export async function POST(req: Request) {
  const event = (await req.json()) as MuxEvent;
  const liveStreamId = event.data?.live_stream_id;
  const playbackId = event.data?.playback_ids?.[0]?.id;

  if (event.type === "video.asset.ready" && liveStreamId && playbackId) {
    const lesson = await prisma.lesson.findFirst({
      where: { muxLiveStreamId: liveStreamId },
      include: { course: true },
    });
    if (lesson) {
      await prisma.lesson.update({
        where: { id: lesson.id },
        data: {
          status: "ended",
          muxVodPlaybackId: playbackId,
        },
      });
      await notifyCourseStudents(lesson.courseId, {
        type: "lesson_live",
        titleUz: "Yozuv tayyor",
        messageUz: `${lesson.course.titleUz}: ${lesson.titleUz}`,
        relatedId: lesson.id,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
