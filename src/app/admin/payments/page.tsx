import { AdminPaymentsBoard, type AdminPaymentRow } from "@/components/admin/AdminPaymentsBoard";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { viewerCanSeeCredentials } from "@/lib/super-admin";

export const dynamic = "force-dynamic";

function dayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dayLabel(date: Date) {
  return new Intl.DateTimeFormat("uz-UZ", {
    timeZone: "Asia/Tashkent",
    day: "numeric",
    month: "short",
  }).format(date);
}

export default async function AdminPaymentsPage() {
  const session = await auth();
  const canSeeSecrets = await viewerCanSeeCredentials(session?.user?.id, session?.user?.role);
  const now = new Date();
  const days14 = new Date(now.getTime() - 13 * 86_400_000);

  const payments = await prisma.payment.findMany({
    include: {
      user: {
        select: canSeeSecrets
          ? { fullName: true, email: true }
          : { fullName: true },
      },
      course: { select: { titleUz: true, teacher: { select: { fullName: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  const rows: AdminPaymentRow[] = payments.map((p) => ({
    id: p.id,
    studentName: p.user.fullName,
    studentEmail: "email" in p.user && typeof p.user.email === "string" ? p.user.email : undefined,
    courseTitle: p.course?.titleUz ?? null,
    teacherName: p.course?.teacher.fullName ?? null,
    tier: p.tier,
    amount: p.amount,
    status: p.status,
    provider: p.provider,
    createdAt: p.createdAt.toISOString(),
  }));

  const buckets = new Map<string, { label: string; value: number }>();
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * 86_400_000);
    buckets.set(dayKey(d), { label: dayLabel(d), value: 0 });
  }
  for (const p of payments) {
    if (p.createdAt < days14) continue;
    if (p.status !== "paid" && p.status !== "demo_paid") continue;
    const row = buckets.get(dayKey(p.createdAt));
    if (row) row.value += p.amount;
  }

  return (
    <AdminPaymentsBoard
      payments={rows}
      chart14={[...buckets.values()]}
      canSeeSecrets={canSeeSecrets}
    />
  );
}
