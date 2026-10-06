import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";
import { notifyUser } from "@/lib/notify";
import { entityIdSchema } from "@/lib/entity-id";

const schema = z.object({
  subject: z.string().trim().min(3).max(120),
  body: z.string().trim().min(10).max(4000),
  courseId: entityIdSchema.optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Kirish kerak" }, { status: 401 });
  const where = isAdminRole(session.user.role) ? {} : { userId: session.user.id };
  const tickets = await prisma.supportTicket.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { fullName: true, email: true } } },
  });
  return NextResponse.json({ tickets });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Kirish kerak" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Mavzu va matnni to‘ldiring" }, { status: 400 });
  const ticket = await prisma.supportTicket.create({
    data: {
      userId: session.user.id,
      courseId: parsed.data.courseId,
      subject: parsed.data.subject,
      body: parsed.data.body,
    },
  });
  const admins = await prisma.user.findMany({
    where: { role: "admin", isBlocked: false },
    select: { id: true },
    take: 5,
  });
  await Promise.all(
    admins.map((admin) =>
      notifyUser({
        userId: admin.id,
        type: "system",
        titleUz: "Yordam so‘rovi",
        messageUz: parsed.data.subject,
        relatedId: ticket.id,
      }).catch(() => undefined),
    ),
  );
  return NextResponse.json({ ticket }, { status: 201 });
}
