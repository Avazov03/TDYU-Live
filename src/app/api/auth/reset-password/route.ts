import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { authError, authLog } from "@/lib/auth-log";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { hashPasswordResetToken } from "@/lib/email";

const schema = z.object({
  token: z.string().min(20, "Havola noto'g'ri"),
  password: z.string().min(8, "Parol kamida 8 belgi").max(100),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    if (!rateLimit(`reset:${ip}`, 10, 15 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring." },
        { status: 429 },
      );
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Noto'g'ri ma'lumotlar" },
        { status: 400 },
      );
    }

    const { token, password } = parsed.data;
    const tokenHash = hashPasswordResetToken(token);
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true, isBlocked: true } } },
    });

    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      authLog("reset_password_invalid_token");
      return NextResponse.json(
        { error: "Havola eskirgan yoki noto'g'ri. Qayta so'rov yuboring." },
        { status: 400 },
      );
    }

    if (record.user.isBlocked) {
      return NextResponse.json(
        { error: "Hisob bloklangan. Administrator bilan bog'laning." },
        { status: 403 },
      );
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: await hashPassword(password) },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      prisma.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null, id: { not: record.id } },
        data: { usedAt: new Date() },
      }),
    ]);

    authLog("reset_password_success", {
      userId: record.userId,
      email: record.user.email,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    authError("reset_password_failed", error);
    return NextResponse.json({ error: "Server xatosi" }, { status: 500 });
  }
}
