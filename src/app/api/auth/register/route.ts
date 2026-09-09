import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { authError, authLog } from "@/lib/auth-log";

const schema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

export async function POST(req: Request) {
  let normalizedEmail = "";

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      authLog("register_validation_failed", {
        issues: parsed.error.issues.map((i) => i.path.join(".")),
      });
      return NextResponse.json({ error: "Noto'g'ri ma'lumotlar" }, { status: 400 });
    }

    const { fullName, email, password } = parsed.data;
    normalizedEmail = email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      authLog("register_duplicate_email", { email: normalizedEmail });
      return NextResponse.json({ error: "Bu email allaqachon ro'yxatdan o'tgan" }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        fullName,
        email: normalizedEmail,
        passwordHash: await hashPassword(password),
        role: "student",
      },
      select: { id: true, email: true, fullName: true },
    });

    authLog("register_success", { userId: user.id, email: normalizedEmail });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    authError("register_failed", error, { email: normalizedEmail || undefined });
    return NextResponse.json({ error: "Server xatosi" }, { status: 500 });
  }
}
