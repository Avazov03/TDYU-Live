/**
 * Server-only Mux Video REST client for request paths (Phase 8.5).
 *
 * - Every call has an explicit timeout (AbortSignal) so a slow Mux never stalls a page render.
 * - Failures are typed (`MuxClientError.kind`) and carry no response body or credentials.
 * - No audit counters: audit tooling keeps using `mux-read-only.ts`.
 * - Live-stream reads return only the status word, never the stream key.
 */

if (typeof window !== "undefined") {
  throw new Error("mux-client is server-only");
}

export const MUX_API_BASE = "https://api.mux.com";
export const MUX_API_TIMEOUT_MS = 2_500;

export type MuxFailureKind = "not_configured" | "timeout" | "network" | "http";

export class MuxClientError extends Error {
  readonly kind: MuxFailureKind;
  readonly status?: number;

  constructor(kind: MuxFailureKind, status?: number) {
    super(status ? `MUX_${kind.toUpperCase()}_${status}` : `MUX_${kind.toUpperCase()}`);
    this.name = "MuxClientError";
    this.kind = kind;
    this.status = status;
  }
}

export type MuxClientOptions = {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

function muxAuthHeader(): string | null {
  const id = process.env.MUX_TOKEN_ID?.trim();
  const secret = process.env.MUX_TOKEN_SECRET?.trim();
  if (!id || !secret) return null;
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

export function isMuxApiConfigured(): boolean {
  return muxAuthHeader() !== null;
}

/** GET a Mux API path. 404 resolves to `{ status: 404, data: null }`; other failures throw MuxClientError. */
export function muxGet<T>(
  path: string,
  opts: MuxClientOptions = {},
): Promise<{ status: number; data: T | null }> {
  return muxRequest<T>("GET", path, opts);
}

async function muxRequest<T>(
  method: "GET" | "PUT",
  path: string,
  opts: MuxClientOptions,
): Promise<{ status: number; data: T | null }> {
  const auth = muxAuthHeader();
  if (!auth) throw new MuxClientError("not_configured");
  const doFetch = opts.fetchImpl ?? fetch;
  const signal = AbortSignal.timeout(opts.timeoutMs ?? MUX_API_TIMEOUT_MS);

  let res: Response;
  try {
    res = await doFetch(`${MUX_API_BASE}${path}`, {
      method,
      headers: { Authorization: auth },
      cache: "no-store",
      signal,
    });
  } catch (err) {
    throw new MuxClientError(isAbort(err) || signal.aborted ? "timeout" : "network");
  }

  if (res.status === 404) return { status: 404, data: null };
  if (!res.ok) throw new MuxClientError("http", res.status);

  try {
    const body = await res.text();
    const json = body ? (JSON.parse(body) as { data?: T } | null) : null;
    return { status: res.status, data: json?.data ?? null };
  } catch (err) {
    throw new MuxClientError(isAbort(err) || signal.aborted ? "timeout" : "network");
  }
}

function isAbort(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name;
  return name === "TimeoutError" || name === "AbortError";
}

export type MuxLiveStreamStatus = "active" | "idle" | "disabled";

export type MuxLiveStreamStatusResult =
  | { status: MuxLiveStreamStatus; degraded: null }
  | { status: "unknown"; degraded: MuxFailureKind | "not_found" | "demo" };

/** GET /video/v1/live-streams/{id} → status only. Never throws. */
export async function fetchMuxLiveStreamStatus(
  liveStreamId: string,
  opts: MuxClientOptions = {},
): Promise<MuxLiveStreamStatusResult> {
  if (!liveStreamId || liveStreamId.startsWith("demo_")) {
    return { status: "unknown", degraded: "demo" };
  }
  try {
    const res = await muxGet<{ status?: string }>(
      `/video/v1/live-streams/${encodeURIComponent(liveStreamId)}`,
      opts,
    );
    if (res.status === 404 || !res.data) return { status: "unknown", degraded: "not_found" };
    const s = res.data.status;
    if (s === "active" || s === "idle" || s === "disabled") return { status: s, degraded: null };
    return { status: "unknown", degraded: "http" };
  } catch (err) {
    const kind = err instanceof MuxClientError ? err.kind : "network";
    return { status: "unknown", degraded: kind };
  }
}

export const MUX_COMPLETE_TIMEOUT_MS = 5_000;

export type MuxCompleteResult =
  | { ok: true; skipped?: "demo" | "not_configured" }
  | { ok: false; reason: MuxFailureKind | "not_found"; status?: number };

/** PUT /video/v1/live-streams/{id}/complete. Never throws, so ending a lesson cannot be blocked by Mux. */
export async function completeMuxLiveStream(
  liveStreamId: string,
  opts: MuxClientOptions = {},
): Promise<MuxCompleteResult> {
  if (!liveStreamId || liveStreamId.startsWith("demo_")) return { ok: true, skipped: "demo" };
  if (!isMuxApiConfigured()) return { ok: true, skipped: "not_configured" };
  try {
    const res = await muxRequest<unknown>(
      "PUT",
      `/video/v1/live-streams/${encodeURIComponent(liveStreamId)}/complete`,
      { timeoutMs: MUX_COMPLETE_TIMEOUT_MS, ...opts },
    );
    if (res.status === 404) return { ok: false, reason: "not_found", status: 404 };
    return { ok: true };
  } catch (err) {
    if (err instanceof MuxClientError) return { ok: false, reason: err.kind, status: err.status };
    return { ok: false, reason: "network" };
  }
}
