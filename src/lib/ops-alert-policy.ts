/** Pure rules for production error alerts (formatting, redaction, throttling). No I/O. */

export type RequestErrorInfo = {
  message: string;
  digest?: string;
  stack?: string;
  method: string;
  path: string;
  routePath: string;
  routeType: string;
};

const SECRET_PATTERNS: [RegExp, string][] = [
  [/\b(postgres(?:ql)?|mysql|redis|mongodb(?:\+srv)?):\/\/[^\s"'`]+/gi, "$1://[redacted]"],
  [/\bbot\d{6,}:[A-Za-z0-9_-]{20,}/g, "bot[redacted]"],
  [/\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, "$1 [redacted]"],
  [/\b(password|passwd|secret|token|api[_-]?key|authorization|cookie)(["']?\s*[:=]\s*)["']?[^\s"',;&]+/gi, "$1$2[redacted]"],
  [/\b[A-Za-z0-9_-]{40,}\b/g, "[redacted]"],
];

export function redactSecrets(text: string): string {
  return SECRET_PATTERNS.reduce((t, [re, to]) => t.replace(re, to), text);
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Next.js control-flow errors (notFound, redirect, …) are not failures. */
export function isIgnorableRequestError(info: Pick<RequestErrorInfo, "message" | "digest">): boolean {
  const d = info.digest ?? "";
  return /^NEXT_(NOT_FOUND|REDIRECT|HTTP_ERROR_FALLBACK)/.test(d) || /^NEXT_(NOT_FOUND|REDIRECT)$/.test(info.message);
}

/** Same route + same first message line = same incident, whatever the digest/query string. */
export function requestErrorFingerprint(info: Pick<RequestErrorInfo, "routePath" | "message">): string {
  const firstLine = (info.message.split("\n")[0] ?? "").replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, "<id>").slice(0, 200);
  return `${info.routePath}::${firstLine}`;
}

export function formatRequestErrorAlert(info: RequestErrorInfo, host: string, suppressed = 0): string {
  const path = info.path.split("?")[0] ?? info.path;
  const message = redactSecrets(info.message).slice(0, 600);
  const stack = info.stack
    ? redactSecrets(
        info.stack
          .split("\n")
          .slice(1, 6)
          .map((l) => l.trim())
          .join("\n"),
      ).slice(0, 900)
    : "";
  const lines = [
    `🔴 <b>Lexify 500</b> · ${escapeHtml(host)}`,
    `<b>${escapeHtml(info.method)}</b> <code>${escapeHtml(path)}</code>`,
    `Route: <code>${escapeHtml(info.routePath)}</code> (${escapeHtml(info.routeType)})`,
    `<pre>${escapeHtml(message)}</pre>`,
  ];
  if (stack) lines.push(`<pre>${escapeHtml(stack)}</pre>`);
  if (info.digest) lines.push(`digest: <code>${escapeHtml(info.digest)}</code>`);
  if (suppressed > 0) lines.push(`(+${suppressed} ta shu xato oldingi xabardan beri)`);
  return lines.join("\n");
}

/** Plain-text version of a Telegram HTML alert (for email). */
export function alertHtmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * Per-process throttle: one alert per fingerprint per `perKeyMs`, at most `globalLimit` alerts per
 * `globalWindowMs`. Suppressed repeats are counted and reported with the next alert of that key.
 */
export class AlertThrottle {
  private readonly lastSent = new Map<string, number>();
  private readonly suppressed = new Map<string, number>();
  private sentTimes: number[] = [];

  constructor(
    private readonly perKeyMs = 10 * 60_000,
    private readonly globalLimit = 20,
    private readonly globalWindowMs = 60 * 60_000,
  ) {}

  /** Returns null when the alert must be dropped, else how many repeats were suppressed before it. */
  take(key: string, now = Date.now()): number | null {
    const last = this.lastSent.get(key);
    this.sentTimes = this.sentTimes.filter((t) => now - t < this.globalWindowMs);
    if ((last !== undefined && now - last < this.perKeyMs) || this.sentTimes.length >= this.globalLimit) {
      this.suppressed.set(key, (this.suppressed.get(key) ?? 0) + 1);
      return null;
    }
    const skipped = this.suppressed.get(key) ?? 0;
    this.suppressed.delete(key);
    this.lastSent.set(key, now);
    this.sentTimes.push(now);
    if (this.lastSent.size > 500) {
      for (const [k, t] of this.lastSent) if (now - t >= this.perKeyMs) this.lastSent.delete(k);
    }
    return skipped;
  }
}
