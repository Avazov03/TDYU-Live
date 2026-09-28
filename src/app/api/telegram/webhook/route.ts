import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/cron-auth";
import { handleTelegramUpdate } from "@/lib/telegram/bot";
import type { TgUpdate } from "@/lib/telegram/api";

/**
 * Webhook (agar domen Telegram DNS da ochilsa).
 * Hozir asosiy kanal — PM2 polling (`npm run bot:telegram`).
 */
export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  const header = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!secret || !safeEqual(header, secret)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const update = (await req.json().catch(() => null)) as TgUpdate | null;
  if (!update) return NextResponse.json({ ok: true });

  try {
    await handleTelegramUpdate(update);
  } catch (err) {
    console.error("[telegram webhook]", err);
  }
  return NextResponse.json({ ok: true });
}
