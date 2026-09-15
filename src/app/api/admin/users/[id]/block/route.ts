import { NextResponse } from "next/server";
import { z } from "zod";
import { auth, isAdminRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdminEmail } from "@/lib/super-admin";

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
  if (!parsed.success) {
    return NextResponse.json({ error: "Noto'g'ri ma'lumot" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, email: true },
  });
  if (!target) return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
  if (target.role !== "student") {
    return NextResponse.json({ error: "Bu yerda faqat o'quvchi bloklanadi" }, { status: 400 });
  }
  if (target.id === session.user.id) {
    return NextResponse.json({ error: "O'zingizni bloklab bo'lmaydi" }, { status: 400 });
  }
  if (isSuperAdminEmail(target.email)) {
    return NextResponse.json({ error: "Super adminni bloklab bo'lmaydi" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id },
    data: { isBlocked: parsed.data.blocked },
  });

  return NextResponse.json({ ok: true });
}
