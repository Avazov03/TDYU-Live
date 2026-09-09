import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { ensureTeacherWorkspace } from "@/lib/teacher-workspace";

const schema = z.object({
  token: z.string().min(10),
  fullName: z.string().trim().min(2).max(100),
  password: z.string().min(8, "Parol kamida 8 belgi").max(100),
});

export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || "Noto'g'ri ma'lumot";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const invite = await prisma.teacherInvite.findUnique({
      where: { token: parsed.data.token },
      include: { teacher: true },
    });
    if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "Link eskirgan yoki ishlatilgan" }, { status: 400 });
    }

    const email = invite.teacher.contactEmail.toLowerCase();
    const passwordHash = await hashPassword(parsed.data.password);
    const fullName = parsed.data.fullName;

    let userId = invite.teacher.userId;
    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: { fullName, passwordHash, role: "teacher", isBlocked: false },
      });
    } else {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.role !== "teacher") {
        return NextResponse.json(
          { error: "Bu email boshqa rol bilan band" },
          { status: 409 },
        );
      }
      const user = existing
        ? await prisma.user.update({
            where: { id: existing.id },
            data: { fullName, passwordHash, role: "teacher", isBlocked: false },
          })
        : await prisma.user.create({
            data: { fullName, email, passwordHash, role: "teacher" },
          });
      userId = user.id;
    }

    await prisma.teacher.update({
      where: { id: invite.teacherId },
      data: { userId, fullName },
    });
    await prisma.teacherInvite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });
    await ensureTeacherWorkspace(invite.teacherId);

    return NextResponse.json({ ok: true, email });
  } catch (error) {
    console.error("invite_accept_failed", error);
    return NextResponse.json({ error: "Hisob ochilmadi. Qayta urinib ko'ring." }, { status: 500 });
  }
}
