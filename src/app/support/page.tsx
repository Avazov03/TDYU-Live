import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SupportDesk } from "@/components/support/SupportDesk";
import { AppShell } from "@/components/layout/AppShell";
import { hasCourseStarted } from "@/lib/refund-policy";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/support");
  const [tickets, purchases] = await Promise.all([
    prisma.supportTicket.findMany({
      where: session.user.role === "admin" ? {} : { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, subject: true, body: true, status: true, createdAt: true },
    }),
    prisma.purchase.findMany({
      where: { userId: session.user.id, status: "completed", legacyBackfill: false },
      include: {
        course: { select: { titleUz: true, lifecycleStatus: true, lessons: { select: { status: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  const refundable = purchases
    .filter(
      (p) =>
        !hasCourseStarted({
          lifecycleStatus: p.course.lifecycleStatus,
          lessonStatuses: p.course.lessons.map((l) => l.status),
        }),
    )
    .map((p) => ({ id: p.id, title: p.course.titleUz, amount: p.amountPaid }));

  return (
    <AppShell>
      <SupportDesk
        tickets={tickets.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() }))}
        refundable={session.user.role === "student" ? refundable : []}
      />
    </AppShell>
  );
}
