import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
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
import {
  isStorageKeyForLesson,
  recordingContentType,
  resolveStorageKeyToPath,
} from "@/lib/recording-storage";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Kirish kerak" }, { status: 401 });
  }

  const { id } = await params;
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: { course: { include: { teacher: true } } },
  });
  if (!lesson) {
    return NextResponse.json({ error: "Yozuv yo'q" }, { status: 404 });
  }

  const staff =
    isAdminRole(session.user.role) ||
    (isTeacherRole(session.user.role) && lesson.course.teacher.userId === session.user.id);

  const reviewV1 = isRecordingReviewV1Enabled();
  const recording = reviewV1 ? await getLatestRecordingForLesson(lesson.id) : null;

  if (reviewV1) {
    if (!recording) {
      return NextResponse.json({ error: "Yozuv yo'q", code: "NO_RECORDING" }, { status: 404 });
    }
    if (staff) {
      if (!teacherMayPreviewRecording({ flagOn: true, recordingStatus: recording.status })) {
        return NextResponse.json({ error: "Yozuv tayyor emas", code: "NOT_READY" }, { status: 403 });
      }
    } else {
      const access = await getLessonAccess(session.user.id, lesson.courseId, lesson.status);
      if (!access.ok) {
        return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
      }
      if (!studentMayPlayRecording({ flagOn: true, recordingStatus: recording.status })) {
        return NextResponse.json(
          { error: "Yozuv hali chop etilmagan", code: "NOT_PUBLISHED" },
          { status: 403 },
        );
      }
    }
  } else {
    if (!lesson.recordingUrl) {
      return NextResponse.json({ error: "Yozuv yo'q" }, { status: 404 });
    }
    if (!staff) {
      const access = await getLessonAccess(session.user.id, lesson.courseId, lesson.status);
      if (!access.ok) {
        return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
      }
    }
  }

  const url = recording?.storageKey || lesson.recordingUrl;
  if (!url) {
    return NextResponse.json({ error: "Yozuv yo'q" }, { status: 404 });
  }

  if (!isStorageKeyForLesson(url, lesson)) {
    return NextResponse.json({ error: "Yozuv yo'q" }, { status: 404 });
  }
  let filePath: string;
  let type: string;
  try {
    const resolved = resolveStorageKeyToPath(url);
    filePath = resolved.absPath;
    type = recordingContentType(resolved.container);
  } catch {
    return NextResponse.json({ error: "Yozuv yo'q" }, { status: 404 });
  }

  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    return NextResponse.json({ error: "Fayl topilmadi" }, { status: 404 });
  }

  const size = fileStat.size;
  const range = req.headers.get("range");

  let start = 0;
  let end = size - 1;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      if (m[1]) start = Number(m[1]);
      if (m[2]) end = Number(m[2]);
    }
    if (start > end || start >= size) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }
  }

  const stream = createReadStream(filePath, { start, end });
  const web = Readable.toWeb(stream) as ReadableStream;
  return new NextResponse(web, {
    status: range ? 206 : 200,
    headers: {
      "Content-Type": type,
      "Accept-Ranges": "bytes",
      "Content-Length": String(end - start + 1),
      ...(range ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
