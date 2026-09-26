/** Client polling policy for /api/live/mux-playback (pure; shared by LiveMuxStage and tests). */

export const LIVE_MUX_POLL_IDLE_MS = 15_000;
export const LIVE_MUX_POLL_ACTIVE_MS = 30_000;
export const LIVE_MUX_POLL_MAX_BACKOFF_MS = 120_000;

export type LiveMuxPollOutcome =
  | { kind: "ok"; status: string }
  | { kind: "error"; consecutiveErrors: number }
  | { kind: "rate_limited"; retryAfterSec: number | null }
  | { kind: "stop"; httpStatus: number };

/** HTTP statuses after which polling must stop (lesson ended, access revoked, flag off). */
export function isTerminalPollStatus(httpStatus: number): boolean {
  return httpStatus === 401 || httpStatus === 403 || httpStatus === 404 || httpStatus === 409;
}

/** Delay before the next poll, or null to stop polling. */
export function nextLiveMuxPollDelay(outcome: LiveMuxPollOutcome): number | null {
  switch (outcome.kind) {
    case "stop":
      return null;
    case "ok":
      return outcome.status === "active" ? LIVE_MUX_POLL_ACTIVE_MS : LIVE_MUX_POLL_IDLE_MS;
    case "rate_limited": {
      const sec = outcome.retryAfterSec;
      const ms = sec && sec > 0 ? sec * 1000 : LIVE_MUX_POLL_ACTIVE_MS * 2;
      return Math.min(ms, LIVE_MUX_POLL_MAX_BACKOFF_MS);
    }
    case "error": {
      const n = Math.max(1, outcome.consecutiveErrors);
      return Math.min(LIVE_MUX_POLL_IDLE_MS * 2 ** n, LIVE_MUX_POLL_MAX_BACKOFF_MS);
    }
  }
}
