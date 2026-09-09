import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDays } from "@/lib/tariffs";

const schema = z.object({
  courseId: z.string().uuid(),
  tier: z.enum(["t1", "t2", "t3"]),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Kirish kerak" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Noto'g'ri ma'lumot" }, { status: 400 });
  }

  const course = await prisma.course.findUnique({ where: { id: parsed.data.courseId } });
  if (!course || !course.isPublished) {
    return NextResponse.json({ error: "Kurs topilmadi" }, { status: 404 });
  }

  const amount =
    parsed.data.tier === "t1"
      ? course.priceT1
      : parsed.data.tier === "t2"
        ? course.priceT2
        : course.priceT3;

  const now = new Date();
  const endsAt = addDays(now, 30);

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        userId: session.user.id,
        courseId: course.id,
        tier: parsed.data.tier,
        amount,
        status: "demo_paid",
        provider: "demo",
      },
    }),
    prisma.subscription.upsert({
      where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
      update: { tier: parsed.data.tier, startsAt: now, endsAt },
      create: {
        userId: session.user.id,
        courseId: course.id,
        tier: parsed.data.tier,
        startsAt: now,
        endsAt,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
