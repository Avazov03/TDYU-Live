import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTeacherForUser } from "@/lib/teacher";

const MAX_BYTES = 20 * 1024 * 1024;

function allowedMime(mime: string) {
  return (
    mime.startsWith("image/") ||
    mime.startsWith("video/") ||
    mime === "application/pdf" ||
    mime.startsWith("application/vnd.") ||
    mime === "application/msword" ||
    mime === "application/octet-stream" ||
    mime === "text/plain"
  );
}

async function ownedLesson(userId: string, lessonId: string) {
  const teacher = await getTeacherForUser(userId);
  if (!teacher) return null;
  return prisma.lesson.findFirst({
    where: { id: lessonId, course: { teacherId: teacher.id } },
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }
  const { id } = await params;
  const lesson = await ownedLesson(session.user.id, id);
  if (!lesson) return NextResponse.json({ error: "Dars topilmadi" }, { status: 404 });

  const items = await prisma.lessonAsset.findMany({
    where: { lessonId: id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }
  const { id } = await params;
  const lesson = await ownedLesson(session.user.id, id);
  if (!lesson) return NextResponse.json({ error: "Dars topilmadi" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Fayl tanlang" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Fayl 20 MB dan oshmasin" }, { status: 400 });
  }
  const mime = file.type || "application/octet-stream";
  if (!allowedMime(mime)) {
    return NextResponse.json({ error: "Bu fayl turiga ruxsat yo'q" }, { status: 400 });
  }

  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const destName = `${id.slice(0, 8)}-${Date.now()}-${safe}`;
  const dir = path.join(process.cwd(), "public", "uploads", "lessons");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, destName), Buffer.from(await file.arrayBuffer()));
  const fileUrl = `/uploads/lessons/${destName}`;

  const item = await prisma.lessonAsset.create({
    data: {
      lessonId: id,
      fileName: file.name.slice(0, 180),
      fileUrl,
      mime,
    },
  });
  return NextResponse.json({ item });
}
