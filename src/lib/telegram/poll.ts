import { deleteWebhook, getUpdates, type TgUpdate } from "@/lib/telegram/api";
import { handleTelegramUpdate } from "@/lib/telegram/bot";

let offset = 0;
let webhookCleared = false;

/** Bir marta getUpdates (cron yoki loop). */
export async function pollTelegramOnce() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return { ok: false, processed: 0, error: "no_token" };
  }

  if (!webhookCleared) {
    await deleteWebhook();
    webhookCleared = true;
  }

  const res = await getUpdates(offset || undefined, 0);
  if (!res.ok || !res.result) {
    return { ok: false, processed: 0, error: res.description ?? "getUpdates_fail" };
  }

  let processed = 0;
  for (const update of res.result) {
    offset = update.update_id + 1;
    try {
      await handleTelegramUpdate(update as TgUpdate);
      processed += 1;
    } catch (err) {
      console.error("[telegram] update error", update.update_id, err);
    }
  }

  return { ok: true, processed, offset };
}
