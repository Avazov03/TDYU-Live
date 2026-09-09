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

  const res = await fetch("https://api.mux.com/video/v1/live-streams", {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      playback_policy: ["public"],
      new_asset_settings: { playback_policy: ["public"] },
      reconnect_window: 60,
      passthrough: lessonTitle,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
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
