/**
 * Long-polling Telegram worker (PM2).
 * dotenv avval yuklanadi — Prisma importidan oldin.
 */
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

async function main() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN yo‘q");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL yo‘q");
    process.exit(1);
  }

  const { deleteWebhook, getUpdates } = await import("../src/lib/telegram/api");
  const { handleTelegramUpdate } = await import("../src/lib/telegram/bot");
  type TgUpdate = import("../src/lib/telegram/api").TgUpdate;

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
