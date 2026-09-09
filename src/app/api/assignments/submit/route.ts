import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveSubscription } from "@/lib/access";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Kirish kerak" }, { status: 401 });

  const form = await req.formData();
  const assignmentId = String(form.get("assignmentId") ?? "");
  const text = String(form.get("text") ?? "").trim();
  const file = form.get("file");

  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) return NextResponse.json({ error: "Topshiriq topilmadi" }, { status: 404 });

  const sub = await getActiveSubscription(session.user.id, assignment.courseId);
  if (!sub) return NextResponse.json({ error: "Obuna yo'q" }, { status: 403 });

  if (!text && !(file instanceof File)) {
    return NextResponse.json({ error: "Matn yoki fayl kiriting" }, { status: 400 });
  }

  let fileName: string | null = null;
  let fileUrl: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "Fayl 8 MB dan oshmasin" }, { status: 400 });
    }
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const destName = `${session.user.id}-${Date.now()}-${safe}`;
    const dir = path.join(process.cwd(), "public", "uploads", "assignments");
    await mkdir(dir, { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, destName), buf);
    fileName = file.name;
    fileUrl = `/uploads/assignments/${destName}`;
  }

  const item = await prisma.submission.upsert({
    where: { assignmentId_userId: { assignmentId, userId: session.user.id } },
    update: { text: text || null, fileName, fileUrl },
    create: {
      assignmentId,
      userId: session.user.id,
      text: text || null,
      fileName,
      fileUrl,
    },
  });

  return NextResponse.json({ item });
}
