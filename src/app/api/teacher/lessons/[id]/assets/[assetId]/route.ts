import { unlink } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTeacherForUser } from "@/lib/teacher";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; assetId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }
  const teacher = await getTeacherForUser(session.user.id);
  if (!teacher) return NextResponse.json({ error: "Profil yo'q" }, { status: 404 });

  const { id, assetId } = await params;
  const item = await prisma.lessonAsset.findFirst({
    where: { id: assetId, lessonId: id, lesson: { course: { teacherId: teacher.id } } },
  });
  if (!item) return NextResponse.json({ error: "Fayl topilmadi" }, { status: 404 });

  if (item.fileUrl.startsWith("/uploads/lessons/")) {
    const disk = path.join(process.cwd(), "public", item.fileUrl.replace(/^\//, ""));
    await unlink(disk).catch(() => undefined);
  }
  await prisma.lessonAsset.delete({ where: { id: item.id } });
  return NextResponse.json({ ok: true });
}
