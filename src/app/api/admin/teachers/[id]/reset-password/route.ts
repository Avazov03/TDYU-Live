import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { ensureTeacherUser } from "@/lib/teacher-account";
import { viewerCanSeeCredentials } from "@/lib/super-admin";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const allowed = await viewerCanSeeCredentials(session?.user?.id, session?.user?.role);
  if (!allowed) {
    return NextResponse.json({ error: "Faqat super admin" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const password = randomBytes(6).toString("base64url");
  const result = await ensureTeacherUser(id, password);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ password, login: result.user.email });
}
