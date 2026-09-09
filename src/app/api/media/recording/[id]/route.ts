import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLessonAccess } from "@/lib/access";
import { isAdminRole, isTeacherRole } from "@/lib/roles";

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
  if (!lesson?.recordingUrl) {
    return NextResponse.json({ error: "Yozuv yo'q" }, { status: 404 });
  }

  const staff =
    isAdminRole(session.user.role) ||
    (isTeacherRole(session.user.role) && lesson.course.teacher.userId === session.user.id);
  if (!staff) {
    const access = await getLessonAccess(session.user.id, lesson.courseId, lesson.status);
    if (!access.ok) {
      return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
    }
  }

  const rel = lesson.recordingUrl.replace(/^\/+/, "");
  if (!rel.startsWith("uploads/recordings/")) {
    return NextResponse.json({ error: "Yozuv yo'q" }, { status: 404 });
  }
  const filePath = path.join(process.cwd(), "public", rel);

  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    return NextResponse.json({ error: "Fayl topilmadi" }, { status: 404 });
  }

  const size = fileStat.size;
  const range = req.headers.get("range");
  const type = rel.endsWith(".mp4") ? "video/mp4" : "video/webm";

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
