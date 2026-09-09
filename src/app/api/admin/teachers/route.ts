import { NextResponse } from "next/server";
import { z } from "zod";
import { auth, isAdminRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createInviteToken, inviteExpiresAt, inviteUrl } from "@/lib/invite";
import { notifyUser } from "@/lib/notify";

const schema = z.object({
  fullName: z.string().trim().min(2),
  contactEmail: z.string().email(),
  facultyId: z.string().uuid(),
  subjectId: z.string().uuid(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Noto'g'ri ma'lumot" }, { status: 400 });

  const teacher = await prisma.teacher.create({
    data: {
      fullName: parsed.data.fullName,
      contactEmail: parsed.data.contactEmail.toLowerCase(),
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
  await notifyUser({
    userId: session.user.id,
    type: "system",
    titleUz: "O'qituvchi invite",
    messageUz: `${teacher.fullName}: ${url}`,
    relatedId: teacher.id,
    email: teacher.contactEmail,
  });

  return NextResponse.json({ teacher, inviteUrl: url }, { status: 201 });
}
