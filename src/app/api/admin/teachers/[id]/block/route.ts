import { NextResponse } from "next/server";
import { z } from "zod";
import { auth, isAdminRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ blocked: z.boolean() });

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Noto'g'ri ma'lumot" }, { status: 400 });

  const teacher = await prisma.teacher.findUnique({ where: { id } });
  if (!teacher) return NextResponse.json({ error: "O'qituvchi topilmadi" }, { status: 404 });
  if (!teacher.userId) {
    return NextResponse.json({ error: "Avval hisob bog'lanishi kerak" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: teacher.userId },
    data: { isBlocked: parsed.data.blocked },
  });

  return NextResponse.json({ ok: true });
}
