"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type MeetRoomProps = {
  lessonId: string;
  displayName: string;
  subject?: string;
  moderator?: boolean;
};

type RemotePeer = { id: string; name: string; stream: MediaStream };

const ICE: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

async function api(body: Record<string, unknown>) {
  const res = await fetch("/api/live/signal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Xona xatosi");
  return data as {
    peers?: { id: string; name: string }[];
    messages?: { id: number; from: string; to: string; data: { kind: string; sdp?: string; candidate?: RTCIceCandidateInit } }[];
    since?: number;
  };
}

function VideoTile({
  stream,
  name,
  muted,
  you,
}: {
  stream: MediaStream | null;
  name: string;
  muted?: boolean;
  you?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <div className="meet-tile">
      {stream ? (
        <video ref={ref} autoPlay playsInline muted={muted} />
      ) : (
        <div className="meet-tile-empty">{name.slice(0, 1)}</div>
      )}
      <span className="meet-tile-name">
        {name}
        {you ? " · siz" : ""}
      </span>
    </div>
  );
}

export function MeetRoom({ lessonId, displayName, moderator }: MeetRoomProps) {
  const peerIdRef = useRef(`p_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcs = useRef(new Map<string, RTCPeerConnection>());
  const names = useRef(new Map<string, string>());
  const sinceRef = useRef(0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remotes, setRemotes] = useState<RemotePeer[]>([]);
  const [error, setError] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const upsertRemote = useCallback((id: string, stream: MediaStream) => {
    setRemotes((prev) => {
      const next = prev.filter((p) => p.id !== id);
      next.push({ id, name: names.current.get(id) || "Ishtirokchi", stream });
      return next;
    });
  }, []);

  const dropRemote = useCallback((id: string) => {
    const pc = pcs.current.get(id);
    pc?.close();
    pcs.current.delete(id);
    names.current.delete(id);
    setRemotes((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const sendSignal = useCallback(
    (to: string, data: { kind: "offer" | "answer" | "ice"; sdp?: string; candidate?: RTCIceCandidateInit }) => {
      void api({
        lessonId,
        peerId: peerIdRef.current,
        name: displayName,
        action: "signal",
        to,
        data,
      });
    },
    [displayName, lessonId],
  );

  const ensurePc = useCallback(
    (otherId: string) => {
      const existing = pcs.current.get(otherId);
      if (existing) return existing;
      const pc = new RTCPeerConnection(ICE);
      pcs.current.set(otherId, pc);
      const local = localStreamRef.current;
      local?.getTracks().forEach((track) => pc.addTrack(track, local));
      pc.onicecandidate = (ev) => {
        if (ev.candidate) sendSignal(otherId, { kind: "ice", candidate: ev.candidate.toJSON() });
      };
      pc.ontrack = (ev) => {
        const stream = ev.streams[0] ?? new MediaStream([ev.track]);
        upsertRemote(otherId, stream);
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") dropRemote(otherId);
      };
      return pc;
    },
    [dropRemote, sendSignal, upsertRemote],
  );

  const callPeer = useCallback(
    async (otherId: string) => {
      if (peerIdRef.current >= otherId) return;
      if (pcs.current.has(otherId)) return;
      const pc = ensurePc(otherId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal(otherId, { kind: "offer", sdp: offer.sdp });
    },
    [ensurePc, sendSignal],
  );

  useEffect(() => {
    let stopped = false;
    const peerId = peerIdRef.current;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
        await api({ lessonId, peerId, name: displayName, action: "join" });
      } catch {
        if (!stopped) setError("Kameraga ruxsat berilmadi. Brauzer so‘roviga «Allow» bosing.");
      }
    };

    void start();

    const poll = window.setInterval(async () => {
      if (stopped || !localStreamRef.current) return;
      try {
        const snap = await api({
          lessonId,
          peerId,
          name: displayName,
          action: "poll",
          since: sinceRef.current,
        });
        sinceRef.current = snap.since ?? sinceRef.current;
        const liveIds = new Set((snap.peers ?? []).map((p) => p.id));
        for (const p of snap.peers ?? []) {
          names.current.set(p.id, p.name);
          await callPeer(p.id);
        }
        for (const id of [...pcs.current.keys()]) {
          if (!liveIds.has(id)) dropRemote(id);
        }
        for (const msg of snap.messages ?? []) {
          const pc = ensurePc(msg.from);
          if (msg.data.kind === "offer" && msg.data.sdp) {
            await pc.setRemoteDescription({ type: "offer", sdp: msg.data.sdp });
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendSignal(msg.from, { kind: "answer", sdp: answer.sdp });
          } else if (msg.data.kind === "answer" && msg.data.sdp) {
            if (pc.signalingState === "have-local-offer") {
              await pc.setRemoteDescription({ type: "answer", sdp: msg.data.sdp });
            }
          } else if (msg.data.kind === "ice" && msg.data.candidate) {
            try {
              await pc.addIceCandidate(msg.data.candidate);
            } catch {
              /* ignore early ICE */
            }
          }
        }
      } catch {
        /* poll retry */
      }
    }, 1200);

    const connections = pcs.current;
    return () => {
      stopped = true;
      window.clearInterval(poll);
      void api({ lessonId, peerId, action: "leave" }).catch(() => undefined);
      connections.forEach((pc) => pc.close());
      connections.clear();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    };
  }, [callPeer, displayName, dropRemote, ensurePc, lessonId, sendSignal]);

  const toggleMic = () => {
    const next = !micOn;
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = next;
    });
    setMicOn(next);
  };

  const toggleCam = () => {
    const next = !camOn;
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = next;
    });
    setCamOn(next);
  };

  return (
    <div className="meet-frame" role="region" aria-label="Jonli dars xonasi">
      {error ? <p className="meet-error">{error}</p> : null}
      <div className={`meet-grid count-${Math.min(remotes.length + 1, 6)}`}>
        <VideoTile stream={camOn ? localStream : null} name={displayName} muted you />
        {remotes.map((p) => (
          <VideoTile key={p.id} stream={p.stream} name={p.name} />
        ))}
      </div>
      <div className="meet-bar">
        <span className="small">
          {moderator ? "O‘qituvchi" : "Talaba"} · {remotes.length + 1} kishi
        </span>
        <div className="meet-bar-actions">
          <button className="btn btn-sm" type="button" onClick={toggleMic}>
            {micOn ? "Mikrofon" : "Mikrofon o‘chiq"}
          </button>
          <button className="btn btn-sm" type="button" onClick={toggleCam}>
            {camOn ? "Kamera" : "Kamera o‘chiq"}
          </button>
        </div>
      </div>
    </div>
  );
}
