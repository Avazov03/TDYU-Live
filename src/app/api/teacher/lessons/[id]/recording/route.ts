import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { after, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTeacherForUser } from "@/lib/teacher";
import { isRecordingMuxIngestV1Enabled, isRecordingReviewV1Enabled } from "@/lib/feature-flags";
import { markRecordingReady } from "@/lib/recording-lifecycle";
import {
  buildRecordingStorageKey,
  detectRecordingContainer,
  RecordingStorageError,
  resolveStorageKeyToPath,
  sha256Buffer,
} from "@/lib/recording-storage";
import { startRecordingMuxIngest } from "@/lib/recording-mux-ingest";

const MAX_BYTES = 120 * 1024 * 1024;

export const maxDuration = 120;

async function openStorageIncident(code: string, lessonId: string) {
  const open = await prisma.incident.findFirst({
    where: { relatedType: "recording_storage", status: "open", title: "Recording storage unavailable" },
  });
  if (!open) {
    await prisma.incident.create({
      data: {
        level: "high",
        title: "Recording storage unavailable",
        detail: code,
        source: "teacher.recording.upload",
        relatedType: "recording_storage",
        relatedId: lessonId,
      },
    });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size < 1000) {
    return NextResponse.json({ error: "Yozuv bo'sh" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Yozuv 120 MB dan oshdi. Qisqaroq dars qiling." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const container = detectRecordingContainer(bytes.subarray(0, 16));
  if (!container) {
    return NextResponse.json({ error: "Yozuv formati noto'g'ri", code: "INVALID_MEDIA" }, { status: 400 });
  }

  let storageKey: string;
  let absPath: string;
  try {
    storageKey = buildRecordingStorageKey({ courseId: lesson.courseId, lessonId: lesson.id, container });
    absPath = resolveStorageKeyToPath(storageKey).absPath;
  } catch (err) {
    const code = err instanceof RecordingStorageError ? err.code : "RECORDING_STORAGE_ERROR";
    await openStorageIncident(code, lesson.id);
    return NextResponse.json({ error: "Yozuv saqlanmadi", code }, { status: 503 });
  }

  const sha256 = sha256Buffer(bytes);
  try {
    await mkdir(path.dirname(absPath), { recursive: true });
    await writeFile(absPath, bytes, { flag: "wx" });
    await writeFile(
      `${absPath}.json`,
      JSON.stringify({
        lessonId: lesson.id,
        courseId: lesson.courseId,
        container,
        size: bytes.length,
        sha256,
        uploadedAt: new Date().toISOString(),
        uploadedBy: session.user.id,
        origin: "live",
      }),
      { flag: "wx" },
    );
  } catch {
    await openStorageIncident("RECORDING_STORAGE_WRITE_FAILED", lesson.id);
    return NextResponse.json({ error: "Yozuv saqlanmadi", code: "RECORDING_STORAGE_WRITE_FAILED" }, { status: 503 });
  }

  const updated = await prisma.lesson.update({
    where: { id: lesson.id },
    data: { recordingUrl: storageKey },
  });

  let recording = null;
  if (isRecordingReviewV1Enabled()) {
    const result = await markRecordingReady({ lessonId: lesson.id, storageKey });
    recording = result.recording;
  }

  if (isRecordingMuxIngestV1Enabled()) {
    const actorId = session.user.id;
    after(async () => {
      await startRecordingMuxIngest({ lessonId: lesson.id, storageKey, expectedSha256: sha256, actorId });
    });
  }

  return NextResponse.json({ url: storageKey, lesson: updated, recording });
}
