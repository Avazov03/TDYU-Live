/**
 * Phase 8.5 — Mux request-path client, status cache, polling policy, feature flag.
 *   npx tsx --test src/lib/live-mux-client.test.ts
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { isLiveMuxPlaybackV1Enabled, isLiveMuxPlaybackV1Requested } from "./feature-flags";
import {
  authorizeLiveMuxPlayback,
  getLiveMuxStatus,
  resetLiveMuxStatusCacheForTests,
  resolveLivePlaybackSource,
} from "./live-mux-playback";
import {
  LIVE_MUX_POLL_ACTIVE_MS,
  LIVE_MUX_POLL_IDLE_MS,
  LIVE_MUX_POLL_MAX_BACKOFF_MS,
  isTerminalPollStatus,
  nextLiveMuxPollDelay,
} from "./live-mux-poll";
import { MuxClientError, completeMuxLiveStream, fetchMuxLiveStreamStatus, muxGet } from "./mux-client";

const ENV_KEYS = ["MUX_TOKEN_ID", "MUX_TOKEN_SECRET", "FF_LIVE_MUX_PLAYBACK_V1", "FF_ENROLLMENT_ACCESS_MODE"];
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  process.env.MUX_TOKEN_ID = "test-id";
  process.env.MUX_TOKEN_SECRET = "test-secret";
  resetLiveMuxStatusCacheForTests();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** fetch that never resolves until aborted — models a hung Mux API. */
const hangingFetch: typeof fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    // AbortSignal.timeout's timer is unref'd; keep the test process alive like a real server.
    const keepAlive = setTimeout(() => undefined, 10_000);
    init?.signal?.addEventListener("abort", () => {
      clearTimeout(keepAlive);
      reject(init.signal?.reason ?? Object.assign(new Error("aborted"), { name: "AbortError" }));
    });
  });

describe("mux-client", () => {
  it("requires credentials", async () => {
    delete process.env.MUX_TOKEN_ID;
    await assert.rejects(muxGet("/x"), (e: unknown) => e instanceof MuxClientError && e.kind === "not_configured");
  });

  it("times out instead of hanging", async () => {
    const t0 = Date.now();
    await assert.rejects(
      muxGet("/x", { timeoutMs: 50, fetchImpl: hangingFetch }),
      (e: unknown) => e instanceof MuxClientError && e.kind === "timeout",
    );
    assert.ok(Date.now() - t0 < 2_000);
  });

  it("maps network and HTTP failures without leaking bodies", async () => {
    const netFail: typeof fetch = async () => {
      throw new TypeError("fetch failed");
    };
    await assert.rejects(muxGet("/x", { fetchImpl: netFail }), (e: unknown) => e instanceof MuxClientError && e.kind === "network");
    const http500: typeof fetch = async () => jsonResponse({ error: { messages: ["secret detail"] } }, 500);
    await assert.rejects(muxGet("/x", { fetchImpl: http500 }), (e: unknown) => {
      assert.ok(e instanceof MuxClientError);
      assert.equal(e.kind, "http");
      assert.equal(e.status, 500);
      assert.ok(!e.message.includes("secret detail"));
      return true;
    });
  });

  it("sends Basic auth and never exposes it in the result", async () => {
    let seenAuth = "";
    const f: typeof fetch = async (_input, init) => {
      seenAuth = new Headers(init?.headers).get("Authorization") ?? "";
      return jsonResponse({ data: { status: "active", stream_key: "sk-should-not-leak" } });
    };
    const r = await fetchMuxLiveStreamStatus("ls1", { fetchImpl: f });
    assert.deepEqual(r, { status: "active", degraded: null });
    assert.ok(seenAuth.startsWith("Basic "));
    assert.ok(!JSON.stringify(r).includes("sk-should-not-leak"));
  });

  it("status lookup never throws", async () => {
    assert.deepEqual(await fetchMuxLiveStreamStatus("demo_x"), { status: "unknown", degraded: "demo" });
    assert.deepEqual(
      await fetchMuxLiveStreamStatus("ls1", { fetchImpl: async () => new Response("", { status: 404 }) }),
      { status: "unknown", degraded: "not_found" },
    );
    assert.deepEqual(
      await fetchMuxLiveStreamStatus("ls1", { timeoutMs: 30, fetchImpl: hangingFetch }),
      { status: "unknown", degraded: "timeout" },
    );
    delete process.env.MUX_TOKEN_SECRET;
    assert.deepEqual(await fetchMuxLiveStreamStatus("ls1"), { status: "unknown", degraded: "not_configured" });
  });
});

describe("completeMuxLiveStream", () => {
  it("PUTs the complete endpoint and accepts an empty body", async () => {
    let seen = "";
    const f: typeof fetch = async (input, init) => {
      seen = `${init?.method} ${String(input)}`;
      return new Response("", { status: 200 });
    };
    assert.deepEqual(await completeMuxLiveStream("ls1", { fetchImpl: f }), { ok: true });
    assert.equal(seen, "PUT https://api.mux.com/video/v1/live-streams/ls1/complete");
  });

  it("reports rejected credentials instead of silently succeeding", async () => {
    const f: typeof fetch = async () => jsonResponse({ error: { messages: ["unauthorized"] } }, 401);
    assert.deepEqual(await completeMuxLiveStream("ls1", { fetchImpl: f }), { ok: false, reason: "http", status: 401 });
  });

  it("never throws or hangs", async () => {
    const netFail: typeof fetch = async () => {
      throw new TypeError("fetch failed");
    };
    assert.deepEqual(await completeMuxLiveStream("ls1", { fetchImpl: netFail }), { ok: false, reason: "network", status: undefined });
    const t0 = Date.now();
    assert.deepEqual(
      await completeMuxLiveStream("ls1", { timeoutMs: 40, fetchImpl: hangingFetch }),
      { ok: false, reason: "timeout", status: undefined },
    );
    assert.ok(Date.now() - t0 < 2_000);
    assert.deepEqual(
      await completeMuxLiveStream("ls1", { fetchImpl: async () => new Response("", { status: 404 }) }),
      { ok: false, reason: "not_found", status: 404 },
    );
  });

  it("skips demo streams and unconfigured environments", async () => {
    assert.deepEqual(await completeMuxLiveStream("demo_x"), { ok: true, skipped: "demo" });
    delete process.env.MUX_TOKEN_ID;
    assert.deepEqual(await completeMuxLiveStream("ls1"), { ok: true, skipped: "not_configured" });
  });
});

describe("getLiveMuxStatus cache", () => {
  it("dedupes concurrent calls and caches for the TTL", async () => {
    let calls = 0;
    const f: typeof fetch = async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 20));
      return jsonResponse({ data: { status: "idle" } });
    };
    let now = 1_000_000;
    const opts = { fetchImpl: f, now: () => now };
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => getLiveMuxStatus("ls-a", "lesson", opts)));
    assert.equal(calls, 1);
    assert.ok(results.every((r) => r.status === "idle"));
    now += 5_000;
    await getLiveMuxStatus("ls-a", "lesson", opts);
    assert.equal(calls, 1);
    now += 6_000;
    await getLiveMuxStatus("ls-a", "lesson", opts);
    assert.equal(calls, 2);
  });

  it("degraded results are cached briefly and logged as structured JSON", async () => {
    const warnings: string[] = [];
    const orig = console.warn;
    console.warn = (msg: string) => warnings.push(String(msg));
    try {
      let now = 2_000_000;
      const opts = { timeoutMs: 20, fetchImpl: hangingFetch, now: () => now };
      const r = await getLiveMuxStatus("ls-slow-stream", "lesson-9", opts);
      assert.deepEqual(r, { status: "unknown", degraded: "timeout" });
      assert.equal(warnings.length, 1);
      const log = JSON.parse(warnings[0]!);
      assert.equal(log.event, "live_mux.status_degraded");
      assert.equal(log.reason, "timeout");
      assert.equal(log.lessonId, "lesson-9");
      assert.equal(log.streamRef, "ls-slo");
      now += 1_000;
      await getLiveMuxStatus("ls-slow-stream", "lesson-9", opts);
      assert.equal(warnings.length, 1, "cached, no second Mux call");
      now += 5_000;
      await getLiveMuxStatus("ls-slow-stream", "lesson-9", opts);
      assert.equal(warnings.length, 2, "retried after degraded TTL");
    } finally {
      console.warn = orig;
    }
  });
});

describe("live polling policy", () => {
  it("polls slower while active than idle", () => {
    assert.equal(nextLiveMuxPollDelay({ kind: "ok", status: "idle" }), LIVE_MUX_POLL_IDLE_MS);
    assert.equal(nextLiveMuxPollDelay({ kind: "ok", status: "active" }), LIVE_MUX_POLL_ACTIVE_MS);
    assert.equal(nextLiveMuxPollDelay({ kind: "ok", status: "unknown" }), LIVE_MUX_POLL_IDLE_MS);
  });

  it("backs off exponentially on errors with a cap", () => {
    const d = [1, 2, 3, 4, 10].map((n) => nextLiveMuxPollDelay({ kind: "error", consecutiveErrors: n }));
    assert.deepEqual(d, [30_000, 60_000, 120_000, LIVE_MUX_POLL_MAX_BACKOFF_MS, LIVE_MUX_POLL_MAX_BACKOFF_MS]);
  });

  it("honours Retry-After and stops on terminal statuses", () => {
    assert.equal(nextLiveMuxPollDelay({ kind: "rate_limited", retryAfterSec: 30 }), 30_000);
    assert.equal(nextLiveMuxPollDelay({ kind: "rate_limited", retryAfterSec: null }), 60_000);
    assert.equal(nextLiveMuxPollDelay({ kind: "stop", httpStatus: 409 }), null);
    for (const s of [401, 403, 404, 409]) assert.equal(isTerminalPollStatus(s), true, String(s));
    for (const s of [200, 429, 500, 503]) assert.equal(isTerminalPollStatus(s), false, String(s));
  });
});

describe("FF_LIVE_MUX_PLAYBACK_V1", () => {
  it("defaults off", () => {
    delete process.env.FF_LIVE_MUX_PLAYBACK_V1;
    process.env.FF_ENROLLMENT_ACCESS_MODE = "enrollment";
    assert.equal(isLiveMuxPlaybackV1Enabled(), false);
  });

  it("is effective only in enrollment access mode", () => {
    process.env.FF_LIVE_MUX_PLAYBACK_V1 = "true";
    for (const mode of ["off", "shadow", "dual"]) {
      process.env.FF_ENROLLMENT_ACCESS_MODE = mode;
      assert.equal(isLiveMuxPlaybackV1Requested(), true);
      assert.equal(isLiveMuxPlaybackV1Enabled(), false, mode);
    }
    process.env.FF_ENROLLMENT_ACCESS_MODE = "enrollment";
    assert.equal(isLiveMuxPlaybackV1Enabled(), true);
  });

  it("flag off denies before any lookup", async () => {
    process.env.FF_LIVE_MUX_PLAYBACK_V1 = "false";
    const d = await authorizeLiveMuxPlayback({ userId: "u1", role: "student", lessonId: "x" });
    assert.deepEqual(d, { ok: false, reason: "disabled" });
  });
});

describe("resolveLivePlaybackSource", () => {
  it("is public until signing exists and carries no token", () => {
    const s = resolveLivePlaybackSource("pb123");
    assert.deepEqual(s, { mode: "public", playerUrl: "https://player.mux.com/pb123" });
  });
});
