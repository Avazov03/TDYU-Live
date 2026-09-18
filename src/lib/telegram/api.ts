/** Telegram Bot API helpers */

export type InlineButton =
  | { text: string; callback_data: string }
  | { text: string; url: string };

export type InlineKeyboard = InlineButton[][];

function token() {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
}

export function siteBaseUrl() {
  return (
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://lexify.zonic.fit"
  ).replace(/\/$/, "");
}

export async function tgApi<T = unknown>(
  method: string,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; result?: T; description?: string }> {
  const t = token();
  if (!t) return { ok: false, description: "TELEGRAM_BOT_TOKEN yo‘q" };
  const res = await fetch(`https://api.telegram.org/bot${t}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  }).catch(() => null);
  if (!res) return { ok: false, description: "network" };
  return (await res.json().catch(() => ({ ok: false }))) as {
    ok: boolean;
    result?: T;
    description?: string;
  };
}

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  opts?: { keyboard?: InlineKeyboard; disablePreview?: boolean },
) {
  return tgApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: opts?.disablePreview ?? true,
    ...(opts?.keyboard
      ? { reply_markup: { inline_keyboard: opts.keyboard } }
      : {}),
  });
}

export async function answerCallbackQuery(id: string, text?: string) {
  return tgApi("answerCallbackQuery", {
    callback_query_id: id,
    text: text ?? "",
    show_alert: false,
  });
}

export async function deleteWebhook() {
  return tgApi("deleteWebhook", { drop_pending_updates: false });
}

export type TgUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number; type: string };
    from?: { id: number; username?: string; first_name?: string };
  };
  callback_query?: {
    id: string;
    data?: string;
    from: { id: number; username?: string; first_name?: string };
    message?: { chat: { id: number }; message_id: number };
  };
};

export async function getUpdates(offset?: number, timeout = 25) {
  return tgApi<TgUpdate[]>("getUpdates", {
    offset,
    timeout,
    allowed_updates: ["message", "callback_query"],
  });
}
