import { isRecordingSignedPlaybackV1Enabled } from "@/lib/feature-flags";

type LiveStreamResult = {
  liveStreamId: string;
  livePlaybackId: string;
  streamKey: string;
  demo: boolean;
};

function muxAuthHeader() {
  const id = process.env.MUX_TOKEN_ID;
  const secret = process.env.MUX_TOKEN_SECRET;
  if (!id || !secret) return null;
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

export { muxPlayerUrl, MUX_RTMP_URL } from "./mux-player";

function demoLiveStream(): LiveStreamResult {
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  return {
    liveStreamId: `demo_live_${token}`,
    livePlaybackId: `demo_play_${token}`,
    streamKey: `demo_key_${token}`,
    demo: true,
  };
}

/** Meet xonasi Muxsiz ham ochiladi; kalit bo‘lsa OBS ixtiyoriy. */
export async function createLiveStreamOrDemo(lessonTitle: string): Promise<LiveStreamResult> {
  try {
    return await createLiveStream(lessonTitle);
  } catch {
    return demoLiveStream();
  }
}

export async function createLiveStream(lessonTitle: string): Promise<LiveStreamResult> {
  const auth = muxAuthHeader();
  if (!auth) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Mux sozlanmagan. MUX_TOKEN_ID va MUX_TOKEN_SECRET kerak.");
    }
    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    return {
      liveStreamId: `demo_live_${token}`,
      livePlaybackId: `demo_play_${token}`,
      streamKey: `demo_key_${token}`,
      demo: true,
    };
  }

  // Wave 2: VOD from live uses signed playback. Live preview stays public for OBS monitoring.
  const vodPolicy = isRecordingSignedPlaybackV1Enabled() ? ["signed"] : ["public"];

  const res = await fetch("https://api.mux.com/video/v1/live-streams", {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      playback_policy: ["public"],
      new_asset_settings: { playback_policy: vodPolicy },
      reconnect_window: 60,
      passthrough: lessonTitle,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (/free plan/i.test(text) || /Live streams are unavailable/i.test(text)) {
      throw new Error("MUX_FREE_PLAN");
    }
    throw new Error(`Mux live-stream xato: ${res.status} ${text}`);
  }

  const json = (await res.json()) as {
    data: {
      id: string;
      stream_key: string;
      playback_ids?: { id: string }[];
    };
  };

  return {
    liveStreamId: json.data.id,
    livePlaybackId: json.data.playback_ids?.[0]?.id ?? json.data.id,
    streamKey: json.data.stream_key,
    demo: false,
  };
}

export async function completeLiveStream(liveStreamId: string) {
  const auth = muxAuthHeader();
  if (!auth || liveStreamId.startsWith("demo_")) return;

  await fetch(`https://api.mux.com/video/v1/live-streams/${liveStreamId}/complete`, {
    method: "PUT",
    headers: { Authorization: auth },
  });
}

export function isMuxConfigured() {
  return Boolean(process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET);
}

export type MuxPlaybackPolicy = "public" | "signed" | "drm";

export type MuxPlaybackIdInfo = {
  playbackId: string;
  policy: MuxPlaybackPolicy;
  objectType: "asset" | "live_stream";
  objectId: string;
};

export type MuxAssetPlaybackId = {
  id: string;
  policy: MuxPlaybackPolicy;
};

/**
 * Resolve playback ID → asset/live stream + policy (Mux REST).
 * GET /video/v1/playback-ids/{PLAYBACK_ID}
 */
export async function getMuxPlaybackIdInfo(
  playbackId: string,
): Promise<MuxPlaybackIdInfo | null> {
  const auth = muxAuthHeader();
  if (!auth || !playbackId || playbackId.startsWith("demo_")) return null;

  const res = await fetch(`https://api.mux.com/video/v1/playback-ids/${playbackId}`, {
    headers: { Authorization: auth },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mux playback-id lookup failed: ${res.status} ${text}`);
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

/**
 * List playback IDs on an asset.
 * GET /video/v1/assets/{ASSET_ID}
 */
export async function listMuxAssetPlaybackIds(
  assetId: string,
): Promise<MuxAssetPlaybackId[]> {
  const auth = muxAuthHeader();
  if (!auth) return [];

  const res = await fetch(`https://api.mux.com/video/v1/assets/${assetId}`, {
    headers: { Authorization: auth },
  });
  if (res.status === 404) return [];
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mux asset lookup failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as {
    data: { playback_ids?: { id: string; policy: MuxPlaybackPolicy }[] };
  };
  return (json.data.playback_ids ?? []).map((p) => ({ id: p.id, policy: p.policy }));
}

/**
 * Create a signed playback ID on an existing asset (additive).
 * POST /video/v1/assets/{ASSET_ID}/playback-ids  { policy: "signed" }
 */
export async function createMuxSignedPlaybackId(assetId: string): Promise<string> {
  const auth = muxAuthHeader();
  if (!auth) throw new Error("MUX_NOT_CONFIGURED");

  const res = await fetch(`https://api.mux.com/video/v1/assets/${assetId}/playback-ids`, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ policy: "signed" }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mux create signed playback failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { data: { id: string; policy: string } };
  return json.data.id;
}

/**
 * Delete a playback ID (e.g. old public after signed mapping verified).
 * DELETE /video/v1/assets/{ASSET_ID}/playback-ids/{PLAYBACK_ID}
 * Never call on production without dual confirm flags.
 */
export async function deleteMuxPlaybackId(assetId: string, playbackId: string): Promise<void> {
  const auth = muxAuthHeader();
  if (!auth) throw new Error("MUX_NOT_CONFIGURED");

  const res = await fetch(
    `https://api.mux.com/video/v1/assets/${assetId}/playback-ids/${playbackId}`,
    {
      method: "DELETE",
      headers: { Authorization: auth },
    },
  );
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Mux delete playback failed: ${res.status} ${text}`);
  }
}
