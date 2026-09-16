import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PLATFORM_PRICES, addDays } from "@/lib/tariffs";

const schema = z.object({
  courseId: z.string().trim().min(1).optional(),
  tier: z.enum(["t1", "t2", "t3"]),
  provider: z.enum(["demo", "payme", "click"]).default("demo"),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Kirish kerak" }, { status: 401 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Noto'g'ri ma'lumot" }, { status: 400 });
    }

    let amount = PLATFORM_PRICES[parsed.data.tier];
    let courseId: string | null = null;
    if (parsed.data.courseId) {
      const course = await prisma.course.findUnique({ where: { id: parsed.data.courseId } });
      if (!course || !course.isPublished) {
        return NextResponse.json({ error: "Kurs topilmadi" }, { status: 404 });
      }
      courseId = course.id;
      amount =
        parsed.data.tier === "t1"
          ? course.priceT1
          : parsed.data.tier === "t2"
            ? course.priceT2
            : course.priceT3;
    }

    const now = new Date();
    const endsAt = addDays(now, 30);
    const userId = session.user.id;
    const tier = parsed.data.tier;

    const payment = await prisma.payment.create({
      data: {
        userId,
        courseId,
        tier,
        amount,
        status: "demo_paid",
        provider: parsed.data.provider,
      },
    });

    await prisma.entitlement.upsert({
      where: { userId },
      update: { tier, startsAt: now, endsAt },
      create: { userId, tier, startsAt: now, endsAt },
    });

    if (courseId) {
      await prisma.subscription.upsert({
        where: { userId_courseId: { userId, courseId } },
        update: { tier, startsAt: now, endsAt },
        create: { userId, courseId, tier, startsAt: now, endsAt },
      });
    }

    return NextResponse.json({
      ok: true,
      next: courseId ? "app" : "onboard",
      payment: {
        id: payment.id,
        amount: payment.amount,
        tier: payment.tier,
        provider: payment.provider,
        endsAt: endsAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("demo_payment_failed", error);
    return NextResponse.json({ error: "To'lov saqlanmadi. Qayta urinib ko'ring." }, { status: 500 });
  }
}
