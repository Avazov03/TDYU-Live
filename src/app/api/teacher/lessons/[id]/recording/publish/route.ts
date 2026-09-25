import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTeacherForUser } from "@/lib/teacher";
import { isRecordingReviewV1Enabled } from "@/lib/feature-flags";
import {
  getLatestRecordingForLesson,
  markRecordingReady,
  publishRecording,
} from "@/lib/recording-lifecycle";
import { isStorageKeyForLesson } from "@/lib/recording-storage";

/** Teacher: recording status for lesson. */
export async function GET(
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
  });
  if (!lesson) return NextResponse.json({ error: "Dars topilmadi" }, { status: 404 });

  const recording = await getLatestRecordingForLesson(lesson.id);
  return NextResponse.json({
    reviewV1: isRecordingReviewV1Enabled(),
    lessonStatus: lesson.status,
    recording,
  });
}

/**
 * Teacher publish OR staging/E2E simulate-ready.
 * Body: { action: "publish" | "simulate_ready" }
 */
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
  });
  if (!lesson) return NextResponse.json({ error: "Dars topilmadi" }, { status: 404 });

  if (!isRecordingReviewV1Enabled()) {
    return NextResponse.json({ error: "Recording review o‘chirilgan" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    recordingUrl?: string;
    muxPlaybackId?: string;
  };
  const action = body.action ?? "publish";

  if (action === "simulate_ready") {
    // Deterministic E2E / staging hook — never on bare production.
    const allowHook =
      process.env.ALLOW_RECORDING_E2E_HOOKS === "1" ||
      process.env.E2E_MUX_WEBHOOK_FIXTURE === "1" ||
      process.env.NODE_ENV !== "production";
    if (!allowHook) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (body.recordingUrl && !isStorageKeyForLesson(body.recordingUrl, lesson)) {
      return NextResponse.json({ error: "Noto'g'ri yozuv kaliti", code: "INVALID_STORAGE_KEY" }, { status: 400 });
    }
    const { recording, advanced } = await markRecordingReady({
      lessonId: lesson.id,
      storageKey: body.recordingUrl ?? lesson.recordingUrl,
      muxPlaybackId: body.muxPlaybackId ?? lesson.muxVodPlaybackId,
    });
    return NextResponse.json({ ok: true, advanced, recording });
  }

  if (action !== "publish") {
    return NextResponse.json({ error: "Noma'lum action" }, { status: 400 });
  }

  const result = await publishRecording({
    lessonId: lesson.id,
    actorId: session.user.id,
    autoPublished: false,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.code }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    already: result.already,
    recording: result.recording,
  });
}
