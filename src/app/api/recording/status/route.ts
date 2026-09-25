import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLessonAccess } from "@/lib/access";
import { isAdminRole, isTeacherRole } from "@/lib/roles";
import { isRecordingReviewV1Enabled } from "@/lib/feature-flags";
import {
  getLatestRecordingForLesson,
  studentMayPlayRecording,
  teacherMayPreviewRecording,
} from "@/lib/recording-lifecycle";

/**
 * Student/teacher: recording availability for a lesson (no bytes).
 * GET /api/recording/status?lessonId=
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Kirish kerak" }, { status: 401 });
  }

  const lessonId = new URL(req.url).searchParams.get("lessonId")?.trim();
  if (!lessonId) {
    return NextResponse.json({ error: "lessonId kerak" }, { status: 400 });
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { course: { include: { teacher: true } } },
  });
  if (!lesson) return NextResponse.json({ error: "Topilmadi" }, { status: 404 });

  const staff =
    isAdminRole(session.user.role) ||
    (isTeacherRole(session.user.role) && lesson.course.teacher.userId === session.user.id);

  if (!staff) {
    const access = await getLessonAccess(session.user.id, lesson.courseId, lesson.status);
    if (!access.ok) {
      return NextResponse.json({ error: "Ruxsat yo'q", code: access.reason }, { status: 403 });
    }
  }

  const reviewV1 = isRecordingReviewV1Enabled();
  if (!reviewV1) {
    const playable = Boolean(lesson.recordingUrl) ||
      Boolean(lesson.muxVodPlaybackId && !lesson.muxVodPlaybackId.startsWith("demo_"));
    return NextResponse.json({
      reviewV1: false,
      playable,
      status: playable ? "legacy_available" : "none",
      published: playable,
    });
  }

  const recording = await getLatestRecordingForLesson(lesson.id);
  if (!recording) {
    return NextResponse.json({
      reviewV1: true,
      playable: false,
      status: "none",
      published: false,
    });
  }

  const playable = staff
    ? teacherMayPreviewRecording({ flagOn: true, recordingStatus: recording.status })
    : studentMayPlayRecording({ flagOn: true, recordingStatus: recording.status });

  return NextResponse.json({
    reviewV1: true,
    playable,
    status: recording.status,
    published: recording.status === "published",
    readyAt: recording.readyAt,
    publishedAt: recording.publishedAt,
    reviewDeadlineAt: recording.reviewDeadlineAt,
    autoPublished: recording.autoPublished,
    recordingId: staff || recording.status === "published" ? recording.id : undefined,
  });
}
