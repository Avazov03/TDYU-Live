import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth, isAdminRole } from "@/lib/auth";
import { ensureTeacherUser } from "@/lib/teacher-account";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const password = randomBytes(6).toString("base64url");
  const result = await ensureTeacherUser(id, password);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ password, login: result.user.email });
}
