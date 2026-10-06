import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { isProductionLikeEnv } from "@/lib/recording-legacy-migration";
import { sendTelegramMessage, siteBaseUrl } from "@/lib/telegram/api";
import {
  AlertThrottle,
  alertHtmlToText,
  formatRequestErrorAlert,
  isIgnorableRequestError,
  requestErrorFingerprint,
  type RequestErrorInfo,
} from "@/lib/ops-alert-policy";

/**
 * Production error alerts.
 * Telegram: OPS_ALERT_TELEGRAM_CHAT_IDS, else every admin with a linked Telegram chat.
 * If nobody is reachable on Telegram: email to OPS_ALERT_EMAILS, else every admin's email.
 * Disabled outside production or with OPS_ALERTS=0.
 */

const throttle = new AlertThrottle();
const RECIPIENT_TTL_MS = 10 * 60_000;
type Recipients = { telegram: string[]; email: string[] };
let recipientCache: { value: Recipients; at: number } | null = null;

export function opsAlertsEnabled(): boolean {
  if (process.env.OPS_ALERTS === "0") return false;
  if (process.env.OPS_ALERTS === "1") return true;
  return isProductionLikeEnv();
}

const list = (v: string | undefined) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

async function recipients(): Promise<Recipients> {
  const telegram = list(process.env.OPS_ALERT_TELEGRAM_CHAT_IDS);
  const email = list(process.env.OPS_ALERT_EMAILS);
  if (telegram.length || email.length) return { telegram, email };
  if (recipientCache && Date.now() - recipientCache.at < RECIPIENT_TTL_MS) return recipientCache.value;
  const admins = await prisma.user.findMany({
    where: { role: "admin" },
    select: { email: true, telegramChatId: true },
  });
  const linked = [...new Set(admins.map((a) => a.telegramChatId).filter((id): id is string => Boolean(id)))];
  const value: Recipients = linked.length
    ? { telegram: linked, email: [] }
    : { telegram: [], email: [...new Set(admins.map((a) => a.email).filter(Boolean))] };
  recipientCache = { value, at: Date.now() };
  return value;
}

function opsLog(level: "info" | "warn", event: string, meta: Record<string, unknown>) {
  const line = JSON.stringify({ scope: "ops", level, event, ts: new Date().toISOString(), ...meta });
  if (level === "warn") console.warn(line);
  else console.info(line);
}

/** Never throws: alerting must not turn one failure into two. */
export async function alertRequestError(info: RequestErrorInfo): Promise<void> {
  try {
    if (!opsAlertsEnabled() || isIgnorableRequestError(info)) return;
    const suppressed = throttle.take(requestErrorFingerprint(info));
    if (suppressed === null) return;
    const to = await recipients();
    if (!to.telegram.length && !to.email.length) {
      opsLog("warn", "alert_no_recipients", { route: info.routePath });
      return;
    }
    const html = formatRequestErrorAlert(info, new URL(siteBaseUrl()).host, suppressed);
    const [tg, mail] = await Promise.all([
      Promise.all(to.telegram.map((id) => sendTelegramMessage(id, html, { disablePreview: true }).then((r) => r.ok))),
      Promise.all(
        to.email.map((addr) => sendEmail(addr, `Lexify 500: ${info.routePath}`, alertHtmlToText(html))),
      ),
    ]);
    opsLog("info", "alert_sent", {
      route: info.routePath,
      telegram: `${tg.filter(Boolean).length}/${tg.length}`,
      email: `${mail.filter(Boolean).length}/${mail.length}`,
    });
  } catch (err) {
    console.error("[ops-alert] failed:", err instanceof Error ? err.message : err);
  }
}
