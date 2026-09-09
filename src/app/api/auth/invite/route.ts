import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { ensureTeacherWorkspace } from "@/lib/teacher-workspace";
import { isUniqueConstraint } from "@/lib/prisma-error";

const schema = z.object({
  token: z.string().min(10, "Link noto'g'ri"),
  fullName: z.string().trim().min(2, "Ism kamida 2 belgi").max(100),
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
      include: { teacher: { include: { user: true } } },
    });
    if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "Link eskirgan yoki ishlatilgan" }, { status: 400 });
    }

    const email = invite.teacher.contactEmail.toLowerCase();
    const passwordHash = await hashPassword(parsed.data.password);
    const fullName = parsed.data.fullName;

    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: { teacherProfile: true },
    });

    if (existingUser?.isBlocked) {
      return NextResponse.json({ error: "Hisob bloklangan. Admin bilan bog'laning." }, { status: 403 });
    }
    if (existingUser?.role === "admin") {
      return NextResponse.json({ error: "Bu email admin hisobi. Boshqa email kerak." }, { status: 409 });
    }
    if (existingUser?.role === "student") {
      return NextResponse.json(
        { error: "Bu email talaba hisobi bilan band. Boshqa email kerak." },
        { status: 409 },
      );
    }

    const linkedOther =
      existingUser?.teacherProfile && existingUser.teacherProfile.id !== invite.teacherId;
    if (linkedOther) {
      return NextResponse.json(
        {
          error: "Bu email bilan o'qituvchi kabineti allaqachon ochilgan. Kirish sahifasidan kiring.",
          code: "already_registered",
          email,
        },
        { status: 409 },
      );
    }

    let userId = invite.teacher.userId ?? existingUser?.id ?? null;
    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: { fullName, passwordHash, role: "teacher", isBlocked: false },
      });
    } else {
      const user = await prisma.user.create({
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
    if (isUniqueConstraint(error)) {
      return NextResponse.json(
        {
          error: "Bu email bilan kabinet allaqachon ochilgan. Kirish sahifasidan kiring.",
          code: "already_registered",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Hisob ochilmadi. Keyinroq qayta urinib ko'ring yoki admin bilan bog'laning." },
      { status: 500 },
    );
  }
}
