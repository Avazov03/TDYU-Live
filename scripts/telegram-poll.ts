/**
 * Long-polling Telegram worker (PM2).
 * Webhook .fit domenida ishlamasa shu jarayon botni jonli qiladi.
 */
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import { deleteWebhook, getUpdates, type TgUpdate } from "../src/lib/telegram/api";
import { handleTelegramUpdate } from "../src/lib/telegram/bot";

async function main() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN yo‘q");
    process.exit(1);
  }

  await deleteWebhook();
  console.log("[telegram-poll] webhook o‘chirildi, polling boshlandi");

  let offset = 0;
  for (;;) {
    try {
      const res = await getUpdates(offset || undefined, 25);
      if (!res.ok) {
        console.error("[telegram-poll]", res.description);
        await sleep(3000);
        continue;
      }
      for (const update of res.result ?? []) {
        offset = update.update_id + 1;
        try {
          await handleTelegramUpdate(update as TgUpdate);
        } catch (err) {
          console.error("[telegram-poll] handle", err);
        }
      }
    } catch (err) {
      console.error("[telegram-poll] loop", err);
      await sleep(3000);
    }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

void main();
