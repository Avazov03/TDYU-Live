import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTelegram } from "@/lib/notify";

type TgUpdate = {
  message?: {
    text?: string;
    chat?: { id: number; type: string };
    from?: { id: number; username?: string };
  };
};

/**
 * Telegram bot webhook.
 * /start → chat ID ko‘rsatadi
 * /start link_<userId> → avtomatik bog‘laydi
 */
export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const header = req.headers.get("x-telegram-bot-api-secret-token");
    if (header !== secret) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const update = (await req.json().catch(() => null)) as TgUpdate | null;
  const msg = update?.message;
  const chatId = msg?.chat?.id;
  const text = (msg?.text ?? "").trim();
  if (!chatId || !text) return NextResponse.json({ ok: true });

  if (text === "/start" || text.startsWith("/start ")) {
    const payload = text === "/start" ? "" : text.slice(7).trim();
    if (payload.startsWith("link_")) {
      const userId = payload.slice(5);
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, fullName: true } });
      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: { telegramChatId: String(chatId) },
        });
        await sendTelegram(
          String(chatId),
          `✅ Lexify ulandi, ${user.fullName}.\nDars eslatmalari shu yerga keladi.`,
        );
        return NextResponse.json({ ok: true });
      }
      await sendTelegram(String(chatId), "❌ Havola eskirgan. Sozlamalardan qayta urinib ko‘ring.");
      return NextResponse.json({ ok: true });
    }

    await sendTelegram(
      String(chatId),
      `Lexify bot.\nSizning Chat ID: <code>${chatId}</code>\n\nYoki Sozlamalardagi «Telegramni ulash» tugmasidan foydalaning.`,
    );
  }

  return NextResponse.json({ ok: true });
}
