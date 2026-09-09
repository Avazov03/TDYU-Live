import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTeacherForUser } from "@/lib/teacher";

const MAX_BYTES = 120 * 1024 * 1024;

export const maxDuration = 120;

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

  const destName = `${id}-${Date.now()}.webm`;
  const dir = path.join(process.cwd(), "public", "uploads", "recordings");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, destName), Buffer.from(await file.arrayBuffer()));
  const recordingUrl = `/uploads/recordings/${destName}`;

  const updated = await prisma.lesson.update({
    where: { id: lesson.id },
    data: { recordingUrl },
  });

  return NextResponse.json({ url: recordingUrl, lesson: updated });
}
