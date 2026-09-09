import { NextResponse } from "next/server";
import { z } from "zod";
import { auth, isAdminRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createImpersonateTicket, randomTeacherPassword } from "@/lib/impersonate";

const schema = z.object({ teacherId: z.string().trim().min(1) });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Noto'g'ri ma'lumot" }, { status: 400 });

  const teacher = await prisma.teacher.findUnique({
    where: { id: parsed.data.teacherId },
    include: { user: true },
  });
  if (!teacher) return NextResponse.json({ error: "O'qituvchi topilmadi" }, { status: 404 });

  let userId = teacher.userId;
  if (!userId) {
    const email = teacher.contactEmail.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.role !== "teacher") {
      return NextResponse.json(
        { error: "Bu email boshqa rol bilan band. Avval invite orqali bog'lang." },
        { status: 409 },
      );
    }
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: { role: "teacher", isBlocked: false, fullName: teacher.fullName },
        })
      : await prisma.user.create({
          data: {
            email,
            fullName: teacher.fullName,
            passwordHash: await hashPassword(randomTeacherPassword()),
            role: "teacher",
          },
        });
    await prisma.teacher.update({
      where: { id: teacher.id },
      data: { userId: user.id },
    });
    userId = user.id;
  } else if (teacher.user?.role !== "teacher") {
    return NextResponse.json({ error: "Bu hisob o'qituvchi emas" }, { status: 400 });
  }

  const ticket = createImpersonateTicket(session.user.id, userId);
  return NextResponse.json({ ticket });
}
