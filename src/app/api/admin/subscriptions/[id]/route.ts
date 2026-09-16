import { NextResponse } from "next/server";
import { z } from "zod";
import { auth, isAdminRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDays } from "@/lib/tariffs";

const schema = z.object({
  action: z.enum(["extend", "cancel"]),
  days: z.number().int().min(1).max(365).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Noto'g'ri ma'lumot" }, { status: 400 });
  }

  const sub = await prisma.subscription.findUnique({ where: { id } });
  if (!sub) {
    return NextResponse.json({ error: "Obuna topilmadi" }, { status: 404 });
  }

  const now = new Date();
  if (parsed.data.action === "cancel") {
    const updated = await prisma.subscription.update({
      where: { id },
      data: { endsAt: now },
    });
    return NextResponse.json({ subscription: updated, action: "cancel" });
  }

  const days = parsed.data.days ?? 30;
  const base = sub.endsAt > now ? sub.endsAt : now;
  const updated = await prisma.subscription.update({
    where: { id },
    data: { endsAt: addDays(base, days) },
  });
  return NextResponse.json({ subscription: updated, action: "extend" });
}
