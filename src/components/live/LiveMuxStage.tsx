"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MeetRoom } from "@/components/live/MeetRoom";
import {
  isTerminalPollStatus,
  nextLiveMuxPollDelay,
  type LiveMuxPollOutcome,
} from "@/lib/live-mux-poll";

type StageStatus = "active" | "idle" | "disabled" | "unknown";

type Props = {
  lessonId: string;
  title: string;
  initialStatus: StageStatus;
  /** Server-built player URL; present only while the stream is active. */
  initialPlayerUrl: string | null;
  /** WebRTC room (questions, chat, hand raise). Null when the viewer may not join. */
  room: { displayName: string; subject: string; moderator: boolean } | null;
  /** Live attendance (AttendanceInterval) is recorded on room join. */
  attendanceTracked: boolean;
};

type RoomState = "out" | "open" | "hidden";

function asStatus(v: unknown): StageStatus {
  return v === "active" || v === "idle" || v === "disabled" ? v : "unknown";
}

/**
 * Phase 8.5 live stage: Mux broadcast for enrolled viewers + opt-in WebRTC room.
 * "Yashirish" hides the room but keeps the connection; "Xonadan chiqish" disconnects.
 * Live-only — replay comes from the Recording lifecycle.
 */
export function LiveMuxStage({
  lessonId,
  title,
  initialStatus,
  initialPlayerUrl,
  room,
  attendanceTracked,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<StageStatus>(initialStatus);
  const [playerUrl, setPlayerUrl] = useState<string | null>(initialPlayerUrl);
  const [degraded, setDegraded] = useState(initialStatus === "unknown");
  const [roomState, setRoomState] = useState<RoomState>("out");
  const refreshedRef = useRef(false);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let errors = 0;
    let lastStatus: string = initialStatus;

    const schedule = (outcome: LiveMuxPollOutcome) => {
      const delay = nextLiveMuxPollDelay(outcome);
      if (stopped || delay === null) return;
      timer = setTimeout(() => void poll(), delay);
    };

    const poll = async () => {
      timer = null;
      if (stopped || document.visibilityState === "hidden") return;
      let res: Response | null = null;
      try {
        res = await fetch(`/api/live/mux-playback?lessonId=${encodeURIComponent(lessonId)}`, {
          cache: "no-store",
        });
      } catch {
        res = null;
      }
      if (stopped) return;
      if (!res) {
        errors += 1;
        setDegraded(true);
        schedule({ kind: "error", consecutiveErrors: errors });
        return;
      }
      if (res.status === 429) {
        const retry = Number(res.headers.get("Retry-After"));
        schedule({ kind: "rate_limited", retryAfterSec: Number.isFinite(retry) ? retry : null });
        return;
      }
      if (isTerminalPollStatus(res.status)) {
        setPlayerUrl(null);
        if (!refreshedRef.current) {
          refreshedRef.current = true;
          router.refresh();
        }
        schedule({ kind: "stop", httpStatus: res.status });
        return;
      }
      if (!res.ok) {
        errors += 1;
        setDegraded(true);
        schedule({ kind: "error", consecutiveErrors: errors });
        return;
      }
      const data = (await res.json().catch(() => null)) as {
        status?: string;
        degraded?: boolean;
        playback?: { playerUrl?: string } | null;
      } | null;
      if (stopped) return;
      errors = 0;
      const next = asStatus(data?.status);
      lastStatus = next;
      setStatus(next);
      setDegraded(Boolean(data?.degraded) || next === "unknown");
      const url = typeof data?.playback?.playerUrl === "string" ? data.playback.playerUrl : null;
      setPlayerUrl((prev) => (prev === url ? prev : url));
      schedule({ kind: "ok", status: next });
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (timer) clearTimeout(timer);
        timer = null;
      } else if (!timer && !stopped) {
        void poll();
      }
    };

    schedule({ kind: "ok", status: lastStatus });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [lessonId, initialStatus, router]);

  const showPlayer = status === "active" && Boolean(playerUrl);
  const idleMessage =
    status === "unknown" || degraded
      ? "Efir holatini hozir tekshirib bo‘lmadi — qayta urinilmoqda. Jonli xona ishlashda davom etadi."
      : status === "disabled"
        ? "Efir hozir to‘xtatilgan."
        : "Efir hali boshlanmagan — o‘qituvchi translyatsiyani boshlashi bilan shu yerda ochiladi.";

  return (
    <section className="live-mux" data-testid="live-mux-stage" data-status={status}>
      <div className="player-wrap">
        {showPlayer ? (
          <iframe
            src={playerUrl!}
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            title={title}
            data-testid="live-mux-player"
          />
        ) : (
          <div
            className={`player-demo course-thumb tone-${(lessonId.charCodeAt(0) % 6) + 1}`}
            data-testid={degraded ? "live-mux-degraded" : "live-mux-idle"}
          >
            <div>
              <div className="badge pending" style={{ marginBottom: 8 }}>
                JONLI EFIR
              </div>
              <h3>{title}</h3>
              <p className="muted small">{idleMessage}</p>
            </div>
          </div>
        )}
      </div>

      {room ? (
        <div className="live-room-panel" data-testid="live-room-panel" data-room={roomState}>
          <div className="live-room-bar">
            <div className="live-room-copy">
              <strong>Jonli xona</strong>
              <p className="muted small" data-testid="live-room-note">
                {roomState === "out"
                  ? "Savol berish, chat va qo‘l ko‘tarish uchun qo‘shiling."
                  : roomState === "hidden"
                    ? "Xona yashirilgan — ulanish saqlanib qoldi."
                    : "Siz jonli xonadasiz."}
                {attendanceTracked && !room.moderator
                  ? " Davomat jonli xonaga qo‘shilganda hisoblanadi."
                  : null}
              </p>
            </div>
            <div className="live-room-actions">
              {roomState === "out" ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  data-testid="live-room-join"
                  onClick={() => setRoomState("open")}
                >
                  Jonli xonaga qo‘shilish
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-sm"
                    data-testid="live-room-toggle"
                    aria-expanded={roomState === "open"}
                    aria-controls="live-room-body"
                    onClick={() => setRoomState((s) => (s === "open" ? "hidden" : "open"))}
                  >
                    {roomState === "open" ? "Yashirish" : "Ko‘rsatish"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    data-testid="live-room-leave"
                    onClick={() => setRoomState("out")}
                  >
                    Xonadan chiqish
                  </button>
                </>
              )}
            </div>
          </div>
          {roomState !== "out" ? (
            <div id="live-room-body" hidden={roomState === "hidden"} data-testid="live-room-body">
              <MeetRoom
                lessonId={lessonId}
                displayName={room.displayName}
                subject={room.subject}
                moderator={room.moderator}
                phase="live"
                suppressTeacherAudio={showPlayer}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
