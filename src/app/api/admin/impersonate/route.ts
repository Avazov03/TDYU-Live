import { NextResponse } from "next/server";
import { z } from "zod";
import { auth, isAdminRole } from "@/lib/auth";
import { createImpersonateTicket } from "@/lib/impersonate";
import { ensureTeacherUser } from "@/lib/teacher-account";

const schema = z.object({ teacherId: z.string().trim().min(1) });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Noto'g'ri ma'lumot" }, { status: 400 });

  const result = await ensureTeacherUser(parsed.data.teacherId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const ticket = createImpersonateTicket(session.user.id, result.user.id);
  return NextResponse.json({ ticket });
}
