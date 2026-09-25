"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  lessonId: string;
  recordingId?: string | null;
  title: string;
};

/**
 * Fetches short-lived signed playback from the server; refreshes before expiry.
 * Never embeds a public Mux URL when Wave 2 is on.
 */
export function SecureMuxPlayer({ lessonId, recordingId, title }: Props) {
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<string>("");
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadToken = useCallback(async () => {
    setError("");
    const res = await fetch("/api/recording/playback-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        recordingId ? { recordingId } : { lessonId },
      ),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setPlayerUrl(null);
      setMediaUrl(null);
      setError(typeof data.code === "string" ? data.code : "RECORDING_ACCESS_DENIED");
      return;
    }
    setMode(data.mode ?? "");
    setPlayerUrl(typeof data.playerUrl === "string" ? data.playerUrl : null);
    setMediaUrl(typeof data.mediaUrl === "string" ? data.mediaUrl : null);

    const ttlSec = typeof data.ttlSec === "number" ? data.ttlSec : 600;
    // Refresh ~60s before expiry so long playback continues with re-authz.
    const refreshIn = Math.max(30_000, (ttlSec - 60) * 1000);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      void loadToken();
    }, refreshIn);
  }, [lessonId, recordingId]);

  useEffect(() => {
    void loadToken();
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [loadToken]);

  if (error) {
    return (
      <div className="player-wrap paywall" data-testid="secure-playback-denied">
        <div>
          <h3 style={{ marginBottom: 8 }}>{title}</h3>
          <p className="muted small">Yozuvga ruxsat yo‘q ({error}).</p>
        </div>
      </div>
    );
  }

  if (mediaUrl && !playerUrl) {
    return (
      <div className="player-wrap">
        <video
          src={mediaUrl}
          controls
          playsInline
          preload="metadata"
          title={title}
          data-testid="recording-player"
          data-playback-mode={mode || "local"}
        />
      </div>
    );
  }

  if (playerUrl) {
    return (
      <div className="player-wrap">
        <iframe
          src={playerUrl}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          title={title}
          data-testid="recording-mux-player"
          data-playback-mode={mode || "mux"}
        />
      </div>
    );
  }

  return (
    <div className="player-wrap" data-testid="secure-playback-loading">
      <div className="muted small" style={{ padding: 24 }}>
        Yozuv yuklanmoqda…
      </div>
    </div>
  );
}
