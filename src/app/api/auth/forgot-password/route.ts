import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authError, authLog } from "@/lib/auth-log";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import {
  appBaseUrl,
  createPasswordResetToken,
  hashPasswordResetToken,
  sendEmail,
} from "@/lib/email";

const schema = z.object({
  email: z.string().email("Email noto'g'ri"),
});

const GENERIC_OK =
  "Agar bu email tizimda bo'lsa, parolni tiklash havolasi yuborildi.";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    if (!rateLimit(`forgot:${ip}`, 5, 15 * 60 * 1000)) {
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

    const email = parsed.data.email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, isBlocked: true, fullName: true },
    });

    // Always same response (don't leak account existence)
    if (!user || user.isBlocked) {
      authLog("forgot_password_no_user_or_blocked", { email });
      return NextResponse.json({ ok: true, message: GENERIC_OK });
    }

    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const rawToken = createPasswordResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashPasswordResetToken(rawToken),
        expiresAt,
      },
    });

    const resetUrl = `${appBaseUrl()}/reset-password?token=${rawToken}`;
    const subject = "Lexify — parolni tiklash";
    const text = [
      `Salom${user.fullName ? `, ${user.fullName}` : ""}!`,
      "",
      "Parolingizni tiklash uchun quyidagi havolani oching (1 soat amal qiladi):",
      resetUrl,
      "",
      "Agar bu so'rovni siz yubormagan bo'lsangiz, bu xatni e'tiborsiz qoldiring.",
    ].join("\n");

    const sent = await sendEmail(user.email, subject, text);
    if (!sent && process.env.NODE_ENV !== "production") {
      authLog("forgot_password_dev_link", { email, resetUrl });
    }

    authLog("forgot_password_requested", { userId: user.id, email, emailed: sent });
    return NextResponse.json({
      ok: true,
      message: GENERIC_OK,
      ...(process.env.NODE_ENV !== "production" && !sent ? { devResetUrl: resetUrl } : {}),
    });
  } catch (error) {
    authError("forgot_password_failed", error);
    return NextResponse.json({ error: "Server xatosi" }, { status: 500 });
  }
}
