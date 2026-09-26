"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { muxPlayerUrl } from "@/lib/mux-player";

type Props = {
  lessonId: string;
  title: string;
  initialPlaybackId: string;
  initialStatus: string;
  /** Existing WebRTC room (MeetRoom) — collapsed while the Mux broadcast is active. */
  children?: ReactNode;
};

const POLL_MS = 10_000;

/**
 * TEMPORARY public live playback (Phase 8.5) — server authorizes via Enrollment first.
 * Live-only; recordings keep SecureMuxPlayer / recording playback auth.
 */
export function LiveMuxStage({ lessonId, title, initialPlaybackId, initialStatus, children }: Props) {
  const router = useRouter();
  const [playbackId, setPlaybackId] = useState<string | null>(initialPlaybackId);
  const [status, setStatus] = useState(initialStatus);
  const [roomOpen, setRoomOpen] = useState(initialStatus !== "active");

  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      const res = await fetch(`/api/live/mux-playback?lessonId=${encodeURIComponent(lessonId)}`, {
        cache: "no-store",
      }).catch(() => null);
      if (stopped || !res) return;
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { playbackId?: string; status?: string };
        setPlaybackId(typeof data.playbackId === "string" ? data.playbackId : null);
        setStatus(typeof data.status === "string" ? data.status : "unknown");
        return;
      }
      setPlaybackId(null);
      if (res.status === 409) router.refresh();
    };
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [lessonId, router]);

  const showMux = Boolean(playbackId) && status === "active";

  return (
    <>
      {showMux ? (
        <div className="player-wrap">
          <iframe
            src={muxPlayerUrl(playbackId!)}
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            title={title}
            data-testid="live-mux-player"
          />
        </div>
      ) : children ? (
        <p className="muted small" data-testid="live-mux-idle" style={{ margin: "0 0 8px" }}>
          Efir (OBS) hali boshlanmagan — jonli xona ochiq.
        </p>
      ) : (
        <div className="player-wrap" data-testid="live-mux-idle">
          <div className={`player-demo course-thumb tone-${(lessonId.charCodeAt(0) % 6) + 1}`}>
            <div>
              <div className="badge pending" style={{ marginBottom: 8 }}>
                JONLI EFIR
              </div>
              <h3>{title}</h3>
              <p className="muted small">Efir hali boshlanmagan — boshlanishi bilan shu yerda ochiladi.</p>
            </div>
          </div>
        </div>
      )}
      {children ? (
        <div className={showMux ? "live-room-fold" : undefined}>
          {showMux ? (
            <button
              type="button"
              className="btn btn-sm"
              aria-expanded={roomOpen}
              onClick={() => setRoomOpen((open) => !open)}
            >
              {roomOpen ? "Jonli xonani yopish" : "Jonli xonaga qo‘shilish"}
            </button>
          ) : null}
          {roomOpen || !showMux ? children : null}
        </div>
      ) : null}
    </>
  );
}
