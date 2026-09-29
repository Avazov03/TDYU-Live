import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notificationHref, type RelatedKind } from "@/lib/notify-policy";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ items: [] });

  const rows = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const systemIds = [...new Set(rows.filter((r) => r.type === "system" && r.relatedId).map((r) => r.relatedId!))];
  const [lessons, courses] = systemIds.length
    ? await Promise.all([
        prisma.lesson.findMany({ where: { id: { in: systemIds } }, select: { id: true } }),
        prisma.course.findMany({ where: { id: { in: systemIds } }, select: { id: true } }),
      ])
    : [[], []];
  const kinds = new Map<string, RelatedKind>();
  for (const l of lessons) kinds.set(l.id, "lesson");
  for (const c of courses) kinds.set(c.id, "course");

  const items = rows.map((r) => ({
    ...r,
    href: notificationHref(r.type, r.relatedId, r.relatedId ? kinds.get(r.relatedId) ?? null : null),
  }));
  return NextResponse.json({ items });
}

export async function PATCH() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Kirish kerak" }, { status: 401 });

  await prisma.notification.updateMany({
    where: { userId: session.user.id, isRead: false },
    data: { isRead: true },
  });
  return NextResponse.json({ ok: true });
}
