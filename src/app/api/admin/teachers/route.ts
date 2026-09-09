import { NextResponse } from "next/server";
import { z } from "zod";
import { auth, isAdminRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createInviteToken, inviteExpiresAt, inviteUrl } from "@/lib/invite";
import { notifyUser } from "@/lib/notify";
import { ensureTeacherWorkspace } from "@/lib/teacher-workspace";

const schema = z.object({
  fullName: z.string().trim().min(2, "Ism kamida 2 belgi"),
  contactEmail: z.string().email("Email noto'g'ri"),
  facultyId: z.string().trim().min(1, "Fakultet tanlang"),
  subjectId: z.string().trim().min(1, "Fan tanlang"),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Noto'g'ri ma'lumot" },
      { status: 400 },
    );
  }

  try {
  const email = parsed.data.contactEmail.toLowerCase();
  const existing = await prisma.teacher.findFirst({
    where: { contactEmail: email },
    include: { user: true },
  });
  if (existing?.userId) {
    return NextResponse.json(
      {
        error:
          "Bu email bilan o'qituvchi kabineti allaqachon ochilgan. Yangi o'qituvchi yaratilmaydi — o'sha login bilan kiring.",
      },
      { status: 409 },
    );
  }
  if (existing) {
    const invite = await prisma.teacherInvite.create({
      data: {
        teacherId: existing.id,
        token: createInviteToken(),
        expiresAt: inviteExpiresAt(),
      },
    });
    const url = inviteUrl(invite.token);
    return NextResponse.json({ teacher: existing, inviteUrl: url, reused: true }, { status: 201 });
  }

  const teacher = await prisma.teacher.create({
    data: {
      fullName: parsed.data.fullName,
      contactEmail: email,
      facultyId: parsed.data.facultyId,
      subjectId: parsed.data.subjectId,
    },
  });

  const invite = await prisma.teacherInvite.create({
    data: {
      teacherId: teacher.id,
      token: createInviteToken(),
      expiresAt: inviteExpiresAt(),
    },
  });

  const url = inviteUrl(invite.token);
  await ensureTeacherWorkspace(teacher.id);
  await notifyUser({
    userId: session.user.id,
    type: "system",
    titleUz: "O'qituvchi invite",
    messageUz: `${teacher.fullName}: ${url}`,
    relatedId: teacher.id,
    email: teacher.contactEmail,
  });

  return NextResponse.json({ teacher, inviteUrl: url }, { status: 201 });
  } catch (error) {
    console.error("admin_teacher_create_failed", error);
    return NextResponse.json(
      { error: "O'qituvchi saqlanmadi. Fakultet va fanni tekshiring." },
      { status: 500 },
    );
  }
}
