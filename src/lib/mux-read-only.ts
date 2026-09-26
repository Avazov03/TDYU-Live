/**
 * Read-only Mux HTTP client for Phase 8 inventory audits.
 *
 * ONLY GET is allowed. Mutation methods throw.
 * Counters are exposed for the final audit report.
 */

export type MuxHttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export type MuxMutationCounters = {
  MUX_GET: number;
  MUX_POST: number;
  MUX_PATCH: number;
  MUX_PUT: number;
  MUX_DELETE: number;
};

const counters: MuxMutationCounters = {
  MUX_GET: 0,
  MUX_POST: 0,
  MUX_PATCH: 0,
  MUX_PUT: 0,
  MUX_DELETE: 0,
};

export function resetMuxReadOnlyCounters(): void {
  counters.MUX_GET = 0;
  counters.MUX_POST = 0;
  counters.MUX_PATCH = 0;
  counters.MUX_PUT = 0;
  counters.MUX_DELETE = 0;
}

export function getMuxReadOnlyCounters(): MuxMutationCounters {
  return { ...counters };
}

function muxAuthHeader(): string | null {
  const id = process.env.MUX_TOKEN_ID;
  const secret = process.env.MUX_TOKEN_SECRET;
  if (!id || !secret) return null;
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

export function isMuxReadCredentialsPresent(): boolean {
  return Boolean(process.env.MUX_TOKEN_ID?.trim() && process.env.MUX_TOKEN_SECRET?.trim());
}

/**
 * GET-only Mux fetch. Any other method throws before network I/O.
 */
export async function muxReadOnlyFetch(
  path: string,
  init?: { method?: MuxHttpMethod },
): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase() as MuxHttpMethod;
  if (method !== "GET") {
    throw new Error(`MUX_READ_ONLY_VIOLATION: ${method} is forbidden in inventory mode`);
  }
  counters.MUX_GET += 1;

  const auth = muxAuthHeader();
  if (!auth) throw new Error("MUX_NOT_CONFIGURED");

  const url = path.startsWith("http") ? path : `https://api.mux.com${path}`;
  return fetch(url, {
    method: "GET",
    headers: { Authorization: auth },
  });
}

export type MuxPlaybackPolicy = "public" | "signed" | "drm";

export type MuxPlaybackLookup = {
  playbackId: string;
  policy: MuxPlaybackPolicy;
  objectType: "asset" | "live_stream";
  objectId: string;
};

/** GET /video/v1/playback-ids/{id} */
export async function readMuxPlaybackId(
  playbackId: string,
): Promise<MuxPlaybackLookup | null> {
  if (!playbackId || playbackId.startsWith("demo_")) return null;
  const res = await muxReadOnlyFetch(`/video/v1/playback-ids/${encodeURIComponent(playbackId)}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mux playback lookup failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    data: {
      id: string;
      policy: MuxPlaybackPolicy;
      object: { type: "asset" | "live_stream"; id: string };
    };
  };
  return {
    playbackId: json.data.id,
    policy: json.data.policy,
    objectType: json.data.object.type,
    objectId: json.data.object.id,
  };
}

export type MuxAssetSummary = {
  assetId: string;
  status: string | null;
  playbackIds: { id: string; policy: MuxPlaybackPolicy }[];
};

/** GET /video/v1/assets/{id} */
export async function readMuxAsset(assetId: string): Promise<MuxAssetSummary | null> {
  const res = await muxReadOnlyFetch(`/video/v1/assets/${encodeURIComponent(assetId)}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mux asset lookup failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    data: {
      id: string;
      status?: string;
      playback_ids?: { id: string; policy: MuxPlaybackPolicy }[];
    };
  };
  return {
    assetId: json.data.id,
    status: json.data.status ?? null,
    playbackIds: (json.data.playback_ids ?? []).map((p) => ({
      id: p.id,
      policy: p.policy,
    })),
  };
}

/** Assert inventory/audit env before any Mux or DB inventory work. */
export function assertAuditOnlyInventoryMode(): void {
  if (process.env.AUDIT_ONLY !== "true") {
    throw new Error("AUDIT_ONLY=true required for Mux inventory");
  }
  if (process.env.RECORDING_MIGRATION_MODE !== "inventory") {
    throw new Error("RECORDING_MIGRATION_MODE=inventory required for Mux inventory");
  }
}
