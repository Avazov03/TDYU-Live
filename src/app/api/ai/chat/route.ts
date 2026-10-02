import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveAiViewer } from "@/lib/ai/gate";
import type { GeminiContent } from "@/lib/ai/gemini";
import { runMentor } from "@/lib/ai/mentor";
import {
  AI_HISTORY_MAX,
  AI_MESSAGE_MAX_CHARS,
  buildSystemPrompt,
  normalizeHistory,
  parsePageContext,
} from "@/lib/ai/policy";
import { toolsForRole } from "@/lib/ai/tools";
import { aiSubjectKey, allowBurst, recordAiTokens, reserveAiRequest } from "@/lib/ai/usage";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  message: z.string().trim().min(1).max(AI_MESSAGE_MAX_CHARS),
  pathname: z.string().max(300).optional(),
  conversationId: z.string().uuid().optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "model"]), text: z.string().max(AI_MESSAGE_MAX_CHARS * 2) }))
    .max(AI_HISTORY_MAX)
    .optional(),
});

const FALLBACK = "Kechirasiz, hozir javob bera olmadim. Birozdan keyin qayta urinib ko‘ring.";

function nowLabel() {
  return new Intl.DateTimeFormat("uz-UZ", {
    timeZone: "Asia/Tashkent",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

/** Saves one user/model exchange; the conversation row is created only once there is a real answer. */
async function persistTurn(userId: string, conversationId: string | null, message: string, answer: string) {
  const at = Date.now();
  const id =
    conversationId ??
    (await prisma.aiConversation.create({ data: { userId, title: message.slice(0, 80) }, select: { id: true } })).id;
  await prisma.$transaction([
    prisma.aiMessage.create({ data: { conversationId: id, role: "user", text: message, createdAt: new Date(at) } }),
    prisma.aiMessage.create({
      data: { conversationId: id, role: "model", text: answer.slice(0, 8000), createdAt: new Date(at + 1) },
    }),
    prisma.aiConversation.update({ where: { id }, data: { updatedAt: new Date(at + 1) } }),
  ]);
  return id;
}

export async function POST(req: Request) {
  const viewer = await resolveAiViewer();
  if (!viewer) return NextResponse.json({ error: "Topilmadi" }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Noto‘g‘ri so‘rov" }, { status: 400 });
  const body = parsed.data;

  const subjectKey = aiSubjectKey(viewer.userId, req);
  if (!allowBurst(subjectKey)) {
    return NextResponse.json({ error: "Juda tez. Bir daqiqadan keyin yozing.", code: "RATE" }, { status: 429 });
  }
  const verdict = await reserveAiRequest(subjectKey, viewer.role);
  if (!verdict.ok) {
    const error =
      verdict.code === "BUDGET"
        ? "AI mentor bugun band. Ertaga qayta urinib ko‘ring."
        : viewer.role === "guest"
          ? "Bugungi limit tugadi. Ko‘proq savol uchun tizimga kiring."
          : "Bugungi savollar limiti tugadi. Ertaga davom etamiz.";
    return NextResponse.json({ error, code: verdict.code }, { status: 429 });
  }

  let conversationId: string | null = null;
  let history: { role: "user" | "model"; text: string }[] = [];
  if (viewer.userId) {
    if (body.conversationId) {
      const conv = await prisma.aiConversation.findFirst({
        where: { id: body.conversationId, userId: viewer.userId },
        select: {
          id: true,
          messages: { orderBy: { createdAt: "desc" }, take: AI_HISTORY_MAX, select: { role: true, text: true } },
        },
      });
      if (conv) {
        conversationId = conv.id;
        history = conv.messages
          .reverse()
          .filter((m) => m.role === "user" || m.role === "model") as typeof history;
      }
    }
  } else {
    history = body.history ?? [];
  }

  const contents: GeminiContent[] = [
    ...normalizeHistory(history).map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    { role: "user", parts: [{ text: body.message }] },
  ];
  const system = buildSystemPrompt({
    role: viewer.role,
    firstName: viewer.firstName,
    page: parsePageContext(body.pathname),
    nowLabel: nowLabel(),
  });
  const ctx = { userId: viewer.userId, role: viewer.role };

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      send({ type: "meta", conversationId, remaining: verdict.remaining });
      let answer = "";
      let tokens = 0;
      try {
        for await (const ev of runMentor({ ctx, system, contents, tools: toolsForRole(viewer.role), signal: req.signal })) {
          if (ev.type === "text") {
            answer += ev.t;
            send({ type: "text", t: ev.t });
          } else if (ev.type === "tool") {
            send({ type: "tool", name: ev.name });
          } else {
            tokens = ev.tokens;
          }
        }
        if (!answer.trim()) {
          send({ type: "text", t: FALLBACK });
        } else if (viewer.userId) {
          const prev = conversationId;
          conversationId = await persistTurn(viewer.userId, prev, body.message, answer).catch((err) => {
            console.error("[ai_chat_persist_failed]", err instanceof Error ? err.message : err);
            return prev;
          });
        }
        send({ type: "done", conversationId });
      } catch (err) {
        if (!req.signal.aborted) {
          console.error("[ai_chat_failed]", err instanceof Error ? err.message : err);
          send({ type: "error", error: FALLBACK });
        }
      } finally {
        await recordAiTokens(subjectKey, tokens).catch((err) =>
          console.error("[ai_usage_record_failed]", err instanceof Error ? err.message : err),
        );
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
