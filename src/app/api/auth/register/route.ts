import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { authError, authLog } from "@/lib/auth-log";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  fullName: z.string().trim().min(2, "Ism kamida 2 belgi").max(100),
  email: z.string().email("Email noto'g'ri"),
  password: z.string().min(8, "Parol kamida 8 belgi").max(100),
});

export async function POST(req: Request) {
  let normalizedEmail = "";

  if (!rateLimit(`register:${getClientIp(req)}`, 30, 15 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Juda ko‘p urinish. 15 daqiqadan keyin qayta urinib ko‘ring." },
      { status: 429 },
    );
  }

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      authLog("register_validation_failed", {
        issues: parsed.error.issues.map((i) => i.path.join(".")),
      });
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Noto'g'ri ma'lumotlar" },
        { status: 400 },
      );
    }

    const { fullName, email, password } = parsed.data;
    normalizedEmail = email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!existing) {
      const user = await prisma.user.create({
        data: {
          fullName,
          email: normalizedEmail,
          passwordHash: await hashPassword(password),
          role: "student",
        },
        select: { id: true },
      });
      authLog("register_success", { userId: user.id });
    } else {
      authLog("register_duplicate_email", {});
    }

    return NextResponse.json({
      ok: true,
      message: "Davom etish uchun kirish sahifasidan kiring.",
    });
  } catch (error) {
    authError("register_failed", error, { email: normalizedEmail || undefined });
    return NextResponse.json({ error: "Server xatosi" }, { status: 500 });
  }
}
