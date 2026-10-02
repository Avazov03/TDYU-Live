import { NextResponse } from "next/server";
import { resolveAiViewer } from "@/lib/ai/gate";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Latest conversation of the signed-in user (to restore the widget). */
export async function GET() {
  const viewer = await resolveAiViewer();
  if (!viewer?.userId) return NextResponse.json({ conversation: null });
  const conv = await prisma.aiConversation.findFirst({
    where: { userId: viewer.userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      messages: { orderBy: { createdAt: "desc" }, take: 30, select: { role: true, text: true } },
    },
  });
  if (!conv) return NextResponse.json({ conversation: null });
  return NextResponse.json({ conversation: { id: conv.id, messages: conv.messages.reverse() } });
}

/** Deletes the user's conversation(s): `?id=` one, otherwise all. */
export async function DELETE(req: Request) {
  const viewer = await resolveAiViewer();
  if (!viewer?.userId) return NextResponse.json({ error: "Kirish kerak" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  const res = await prisma.aiConversation.deleteMany({
    where: { userId: viewer.userId, ...(id ? { id } : {}) },
  });
  return NextResponse.json({ ok: true, deleted: res.count });
}
