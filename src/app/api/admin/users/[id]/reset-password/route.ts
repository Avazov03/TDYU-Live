import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { viewerCanSeeCredentials } from "@/lib/super-admin";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const allowed = await viewerCanSeeCredentials(session?.user?.id, session?.user?.role);
  if (!allowed) {
    return NextResponse.json({ error: "Faqat super admin" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Foydalanuvchi topilmadi" }, { status: 404 });
  }

  const password = randomBytes(6).toString("base64url");
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password) },
  });

  return NextResponse.json({ password, login: user.email });
}
