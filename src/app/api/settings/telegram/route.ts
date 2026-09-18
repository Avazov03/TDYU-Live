import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  telegramChatId: z
    .string()
    .trim()
    .max(64)
    .regex(/^-?\d*$/, "Faqat raqam")
    .optional()
    .or(z.literal("")),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Kirish kerak" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Noto‘g‘ri ma’lumot" }, { status: 400 });
  }

  const telegramChatId = parsed.data.telegramChatId?.trim() || null;
  await prisma.user.update({
    where: { id: session.user.id },
    data: { telegramChatId },
  });

  return NextResponse.json({ ok: true, telegramChatId });
}
