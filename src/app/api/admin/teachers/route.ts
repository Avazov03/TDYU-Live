import { NextResponse } from "next/server";
import { z } from "zod";
import { auth, isAdminRole } from "@/lib/auth";
import { viewerCanSeeCredentials } from "@/lib/super-admin";
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
  // Serialised per email: a double click or two admins must not create two profiles.
  const { teacher, isNew } = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`teacher-email:${email}`}))`;
    const found = await tx.teacher.findFirst({ where: { contactEmail: email } });
    if (found) return { teacher: found, isNew: false };
    const created = await tx.teacher.create({
      data: {
        fullName: parsed.data.fullName,
        contactEmail: email,
        facultyId: parsed.data.facultyId,
        subjectId: parsed.data.subjectId,
      },
    });
    return { teacher: created, isNew: true };
  });
  if (!isNew && teacher.userId) {
    return NextResponse.json(
      {
        error:
          "Bu email bilan o'qituvchi kabineti allaqachon ochilgan. Yangi o'qituvchi yaratilmaydi — o'sha login bilan kiring.",
      },
      { status: 409 },
    );
  }
  if (!isNew) {
    const invite = await prisma.teacherInvite.create({
      data: {
        teacherId: teacher.id,
        token: createInviteToken(),
        expiresAt: inviteExpiresAt(),
      },
    });
    const url = inviteUrl(invite.token);
    const canSeeSecrets = await viewerCanSeeCredentials(session.user.id, session.user.role);
    return NextResponse.json(
      { teacher: canSeeSecrets ? teacher : { id: teacher.id, fullName: teacher.fullName }, inviteUrl: url, reused: true },
      { status: 201 },
    );
  }

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

  const canSeeSecrets = await viewerCanSeeCredentials(session.user.id, session.user.role);
  return NextResponse.json(
    {
      teacher: canSeeSecrets ? teacher : { id: teacher.id, fullName: teacher.fullName },
      inviteUrl: url,
    },
    { status: 201 },
  );
  } catch (error) {
    console.error("admin_teacher_create_failed", error);
    return NextResponse.json(
      { error: "O'qituvchi saqlanmadi. Fakultet va fanni tekshiring." },
      { status: 500 },
    );
  }
}
