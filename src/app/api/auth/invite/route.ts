import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

const schema = z.object({
  token: z.string().min(10),
  fullName: z.string().trim().min(2).max(100),
  password: z.string().min(8).max(100),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Noto'g'ri ma'lumot" }, { status: 400 });
  }

  const invite = await prisma.teacherInvite.findUnique({
    where: { token: parsed.data.token },
    include: { teacher: true },
  });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Link eskirgan" }, { status: 400 });
  }

  const email = invite.teacher.contactEmail.toLowerCase();
  const passwordHash = await hashPassword(parsed.data.password);

  const user = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { email } });
    const user = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: {
            fullName: parsed.data.fullName,
            passwordHash,
            role: "teacher",
            isBlocked: false,
          },
        })
      : await tx.user.create({
          data: {
            fullName: parsed.data.fullName,
            email,
            passwordHash,
            role: "teacher",
          },
        });

    await tx.teacher.update({
      where: { id: invite.teacherId },
      data: { userId: user.id, fullName: parsed.data.fullName },
    });
    await tx.teacherInvite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });
    return user;
  });

  return NextResponse.json({ ok: true, email: user.email });
}
