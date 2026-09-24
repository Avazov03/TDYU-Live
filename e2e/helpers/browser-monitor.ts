import type { Page, Request, Response, ConsoleMessage } from "@playwright/test";

export type BrowserIssue = {
  kind: "console" | "pageerror" | "requestfailed" | "http";
  severity: "critical" | "non_critical";
  message: string;
  url?: string;
  status?: number;
};

export type MonitorOptions = {
  /** Same-origin path prefixes treated as application APIs (5xx always critical). */
  appApiPrefixes?: string[];
  /** Extra URL substrings that are never critical (favicon, analytics, etc.). */
  ignoreUrlSubstrings?: string[];
};

const DEFAULT_IGNORE = [
  "/favicon",
  "favicon.ico",
  "apple-touch-icon",
  "/_next/static/",
  "googletagmanager",
  "google-analytics",
  "gtag/",
  "doubleclick",
  "facebook.net",
  "hotjar",
  "sentry.io",
  "clarity.ms",
];

const DEFAULT_API_PREFIXES = ["/api/"];

/**
 * Filtering logic (documented for QA):
 *
 * CRITICAL
 * - pageerror / uncaught exception
 * - console "error" that is not filtered noise
 * - same-origin application HTTP 5xx (500/502/503/…)
 * - failed same-origin application API requests (network error), excluding aborts
 *
 * NON-CRITICAL (recorded, does not fail assertNoCriticalBrowserErrors)
 * - favicon / apple-touch-icon
 * - analytics / third-party trackers
 * - intentionally blocked third-party resources
 * - HTTP 401/403 (role isolation may be expected)
 * - known external CDN failures when the test does not depend on them
 * - aborted navigations (NS_BINDING_ABORTED / net::ERR_ABORTED)
 */
export class BrowserMonitor {
  private issues: BrowserIssue[] = [];
  private lastAction = "";
  private attached = false;
  private readonly ignore: string[];
  private readonly apiPrefixes: string[];

  constructor(
    private readonly page: Page,
    options: MonitorOptions = {},
  ) {
    this.ignore = [...DEFAULT_IGNORE, ...(options.ignoreUrlSubstrings ?? [])];
    this.apiPrefixes = options.appApiPrefixes ?? DEFAULT_API_PREFIXES;
  }

  attach(): void {
    if (this.attached) return;
    this.attached = true;

    this.page.on("console", (msg) => this.onConsole(msg));
    this.page.on("pageerror", (err) => {
      this.issues.push({
        kind: "pageerror",
        severity: "critical",
        message: err.message || String(err),
        url: this.page.url(),
      });
    });
    this.page.on("requestfailed", (req) => this.onRequestFailed(req));
    this.page.on("response", (res) => this.onResponse(res));
  }

  noteAction(label: string): void {
    this.lastAction = label;
  }

  getIssues(): BrowserIssue[] {
    return [...this.issues];
  }

  getCritical(): BrowserIssue[] {
    return this.issues.filter((i) => i.severity === "critical");
  }

  formatReport(): string {
    const critical = this.getCritical();
    const lines: string[] = [];
    lines.push(`Page: ${this.page.url()}`);
    if (this.lastAction) lines.push(`Last action: ${this.lastAction}`);

    if (critical.length) {
      lines.push("Browser errors:");
      for (const i of critical.filter((x) => x.kind === "console" || x.kind === "pageerror")) {
        lines.push(`- ${i.message}`);
      }
      const apis = critical.filter((x) => x.kind === "http" || x.kind === "requestfailed");
      if (apis.length) {
        lines.push("Failed API:");
        for (const i of apis) {
          lines.push(`- ${i.message}${i.status != null ? ` (HTTP ${i.status})` : ""}`);
        }
      }
    } else {
      lines.push("No critical browser/network issues recorded.");
    }

    const soft = this.issues.filter((i) => i.severity === "non_critical");
    if (soft.length) {
      lines.push("Non-critical (ignored for pass/fail):");
      for (const i of soft.slice(0, 20)) {
        lines.push(`- [${i.kind}] ${i.message}`);
      }
    }

    return lines.join("\n");
  }

  assertNoCriticalBrowserErrors(): void {
    const critical = this.getCritical();
    if (critical.length === 0) return;
    throw new Error(this.formatReport());
  }

  private onConsole(msg: ConsoleMessage): void {
    if (msg.type() !== "error") return;
    const text = msg.text();
    const loc = msg.location().url || this.page.url();
    if (this.isIgnoredUrl(loc) || this.isIgnoredMessage(text)) {
      this.issues.push({
        kind: "console",
        severity: "non_critical",
        message: text,
        url: loc,
      });
      return;
    }
    this.issues.push({
      kind: "console",
      severity: "critical",
      message: text,
      url: loc,
    });
  }

  private onRequestFailed(req: Request): void {
    const url = req.url();
    const failure = req.failure()?.errorText ?? "request failed";
    if (this.isAbort(failure) || this.isIgnoredUrl(url) || !this.isAppApi(url)) {
      this.issues.push({
        kind: "requestfailed",
        severity: "non_critical",
        message: `${req.method()} ${this.shortUrl(url)} — ${failure}`,
        url,
      });
      return;
    }
    this.issues.push({
      kind: "requestfailed",
      severity: "critical",
      message: `${req.method()} ${this.shortUrl(url)} — ${failure}`,
      url,
    });
  }

  private onResponse(res: Response): void {
    const status = res.status();
    if (status < 500) return;
    const url = res.url();
    if (this.isIgnoredUrl(url) || !this.isSameOrigin(url)) {
      this.issues.push({
        kind: "http",
        severity: "non_critical",
        message: `${res.request().method()} ${this.shortUrl(url)}`,
        url,
        status,
      });
      return;
    }
    // Application origin 5xx is always critical (including document navigations).
    this.issues.push({
      kind: "http",
      severity: "critical",
      message: `${res.request().method()} ${this.shortUrl(url)}`,
      url,
      status,
    });
  }

  private isAppApi(url: string): boolean {
    try {
      const u = new URL(url);
      const base = new URL(this.page.url());
      if (u.origin !== base.origin) return false;
      return this.apiPrefixes.some((p) => u.pathname.startsWith(p));
    } catch {
      return false;
    }
  }

  private isSameOrigin(url: string): boolean {
    try {
      return new URL(url).origin === new URL(this.page.url()).origin;
    } catch {
      return false;
    }
  }

  private isIgnoredUrl(url: string): boolean {
    const lower = url.toLowerCase();
    return this.ignore.some((s) => lower.includes(s.toLowerCase()));
  }

  private isIgnoredMessage(text: string): boolean {
    const lower = text.toLowerCase();
    if (lower.includes("favicon")) return true;
    if (lower.includes("net::err_blocked_by_client")) return true;
    if (lower.includes("failed to load resource") && this.ignore.some((s) => lower.includes(s))) {
      return true;
    }
    return false;
  }

  private isAbort(failure: string): boolean {
    const f = failure.toLowerCase();
    return f.includes("aborted") || f.includes("ns_binding_aborted") || f.includes("err_aborted");
  }

  private shortUrl(url: string): string {
    try {
      const u = new URL(url);
      return `${u.pathname}${u.search}`;
    } catch {
      return url;
    }
  }
}
