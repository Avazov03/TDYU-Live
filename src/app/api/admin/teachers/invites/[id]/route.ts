import { NextResponse } from "next/server";
import { auth, isAdminRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const invite = await prisma.teacherInvite.findUnique({ where: { id } });
  if (!invite) return NextResponse.json({ error: "Havola topilmadi" }, { status: 404 });
  if (invite.usedAt) {
    return NextResponse.json({ error: "Bu havola allaqachon ishlatilgan" }, { status: 400 });
  }

  await prisma.teacherInvite.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
