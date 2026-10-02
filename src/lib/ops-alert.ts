import { prisma } from "@/lib/prisma";
import { isProductionLikeEnv } from "@/lib/recording-legacy-migration";
import { sendTelegramMessage, siteBaseUrl } from "@/lib/telegram/api";
import {
  AlertThrottle,
  formatRequestErrorAlert,
  isIgnorableRequestError,
  requestErrorFingerprint,
  type RequestErrorInfo,
} from "@/lib/ops-alert-policy";

/**
 * Production error alerts to Telegram.
 * Recipients: OPS_ALERT_TELEGRAM_CHAT_IDS (comma-separated) or, if unset, every admin with a linked
 * Telegram chat. Disabled outside production or with OPS_ALERTS=0.
 */

const throttle = new AlertThrottle();
const RECIPIENT_TTL_MS = 10 * 60_000;
let recipientCache: { ids: string[]; at: number } | null = null;

export function opsAlertsEnabled(): boolean {
  if (process.env.OPS_ALERTS === "0") return false;
  if (process.env.OPS_ALERTS === "1") return true;
  return isProductionLikeEnv();
}

async function recipients(): Promise<string[]> {
  const configured = (process.env.OPS_ALERT_TELEGRAM_CHAT_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (configured.length) return configured;
  if (recipientCache && Date.now() - recipientCache.at < RECIPIENT_TTL_MS) return recipientCache.ids;
  const admins = await prisma.user.findMany({
    where: { role: "admin", telegramChatId: { not: null } },
    select: { telegramChatId: true },
  });
  const ids = [...new Set(admins.map((a) => a.telegramChatId!).filter(Boolean))];
  recipientCache = { ids, at: Date.now() };
  return ids;
}

/** Never throws: alerting must not turn one failure into two. */
export async function alertRequestError(info: RequestErrorInfo): Promise<void> {
  try {
    if (!opsAlertsEnabled() || isIgnorableRequestError(info)) return;
    const suppressed = throttle.take(requestErrorFingerprint(info));
    if (suppressed === null) return;
    const ids = await recipients();
    if (!ids.length) {
      console.warn(JSON.stringify({ scope: "ops", level: "warn", event: "alert_no_recipients", route: info.routePath }));
      return;
    }
    const text = formatRequestErrorAlert(info, new URL(siteBaseUrl()).host, suppressed);
    const results = await Promise.all(ids.map((id) => sendTelegramMessage(id, text, { disablePreview: true })));
    console.info(
      JSON.stringify({
        scope: "ops",
        level: "info",
        event: "alert_sent",
        route: info.routePath,
        delivered: results.filter((r) => r.ok).length,
        recipients: ids.length,
      }),
    );
  } catch (err) {
    console.error("[ops-alert] failed:", err instanceof Error ? err.message : err);
  }
}
