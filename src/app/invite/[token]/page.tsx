import { notFound } from "next/navigation";
import { InviteForm } from "@/components/auth/InviteForm";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await prisma.teacherInvite.findUnique({
    where: { token },
    include: { teacher: true },
  });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) notFound();

  return <InviteForm token={token} email={invite.teacher.contactEmail} />;
}
