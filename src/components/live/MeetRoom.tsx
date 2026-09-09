"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { Icon } from "@/components/ui/Icon";

type MeetRoomProps = {
  lessonId: string;
  displayName: string;
  subject?: string;
  moderator?: boolean;
};

export type MeetRoomHandle = {
  saveRecording: () => Promise<string | null>;
  presentFile: (file: { fileUrl: string; fileName: string; mime: string }) => void;
};

type PeerInfo = {
  id: string;
  name: string;
  role: "moderator" | "student";
  handRaised: boolean;
  canSpeak: boolean;
  allowCam: boolean;
  micOn: boolean;
  camOn: boolean;
};

type PresentState = { fileUrl: string; fileName: string; mime: string } | null;
type ChatLine = { id: number; from: string; name: string; text: string };
type Focus = "auto" | "teacher" | "content" | "self" | string;

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
    peers?: PeerInfo[];
    self?: PeerInfo | null;
    messages?: {
      id: number;
      from: string;
      to: string;
      data: { kind: string; sdp?: string; candidate?: RTCIceCandidateInit };
    }[];
    present?: PresentState;
    pointer?: { on: boolean; x: number; y: number };
    chat?: ChatLine[];
    since?: number;
  };
}

function recorderOptions(): MediaRecorderOptions {
  const opts: MediaRecorderOptions = { videoBitsPerSecond: 700_000, audioBitsPerSecond: 64_000 };
  if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) {
    opts.mimeType = "video/webm;codecs=vp8,opus";
  } else if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("video/webm")) {
    opts.mimeType = "video/webm";
  }
  return opts;
}

function isOfficeFile(name: string, mime: string) {
  const n = name.toLowerCase();
  return (
    /\.(docx?|pptx?|xlsx?)$/i.test(n) ||
    mime.includes("officedocument") ||
    mime.includes("msword") ||
    mime.includes("ms-powerpoint") ||
    mime.includes("ms-excel")
  );
}

function isPdfFile(name: string, mime: string) {
  return mime === "application/pdf" || name.toLowerCase().endsWith(".pdf");
}

function officeViewerSrc(fileUrl: string) {
  const abs = `${window.location.origin}${fileUrl}`;
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(abs)}`;
}

function PresentPane({ present }: { present: PresentState }) {
  if (!present) return null;
  const mime = present.mime || "";
  if (mime.startsWith("image/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="meet-slide-media" src={present.fileUrl} alt={present.fileName} />
    );
  }
  if (mime.startsWith("video/")) {
    return <video className="meet-slide-media" src={present.fileUrl} controls playsInline />;
  }
  if (isPdfFile(present.fileName, mime)) {
    return <iframe className="meet-slide-media" src={`${present.fileUrl}#toolbar=1`} title={present.fileName} />;
  }
  if (isOfficeFile(present.fileName, mime)) {
    return (
      <iframe
        className="meet-slide-media"
        src={officeViewerSrc(present.fileUrl)}
        title={present.fileName}
        allow="fullscreen"
      />
    );
  }
  return (
    <div className="meet-slide-file">
      <Icon name="file" size={40} />
      <p>{present.fileName}</p>
      <a className="btn btn-sm" href={present.fileUrl} target="_blank" rel="noreferrer">
        Ochish
      </a>
    </div>
  );
}

function PresentBoard({
  present,
  pointer,
  pointing,
  onPointer,
}: {
  present: PresentState;
  pointer: { on: boolean; x: number; y: number };
  pointing?: boolean;
  onPointer?: (x: number, y: number) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const move = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!pointing || !onPointer || !boxRef.current) return;
    const r = boxRef.current.getBoundingClientRect();
    const x = r.width ? (e.clientX - r.left) / r.width : 0;
    const y = r.height ? (e.clientY - r.top) / r.height : 0;
    onPointer(Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y)));
  };
  return (
    <div
      ref={boxRef}
      className={`meet-present-board${pointing ? " is-pointing" : ""}`}
      onMouseMove={move}
    >
      <PresentPane present={present} />
      {present ? <span className="meet-tile-name">{present.fileName}</span> : null}
      {pointer.on ? (
        <span className="meet-laser" style={{ left: `${pointer.x * 100}%`, top: `${pointer.y * 100}%` }} />
      ) : null}
    </div>
  );
}

function VideoPane({
  stream,
  name,
  muted,
  you,
  speaking,
  hand,
  micOff,
  camOff,
  compact,
  onClick,
  children,
}: {
  stream: MediaStream | null;
  name: string;
  muted?: boolean;
  you?: boolean;
  speaking?: boolean;
  hand?: boolean;
  micOff?: boolean;
  camOff?: boolean;
  compact?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  const showVideo = Boolean(stream && !camOff && stream.getVideoTracks().some((t) => t.enabled && t.readyState === "live"));
  return (
    <div
      className={`meet-tile${compact ? " is-compact" : ""}${speaking ? " is-speaking" : ""}${hand ? " has-hand" : ""}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) onClick();
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {showVideo ? (
        <video ref={ref} autoPlay playsInline muted={muted} />
      ) : (
        <div className="meet-tile-empty">{name.slice(0, 1).toUpperCase()}</div>
      )}
      <span className="meet-tile-name">
        {name}
        {you ? " · siz" : ""}
      </span>
      <span className="meet-tile-flags">
        {hand ? <span className="meet-flag hand">✋</span> : null}
        {micOff ? <span className="meet-flag off"><Icon name="micoff" size={12} /></span> : null}
      </span>
      {children}
    </div>
  );
}

function useSpeaking(stream: MediaStream | null, enabled: boolean) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!stream || !enabled) return;
    const track = stream.getAudioTracks()[0];
    if (!track || !track.enabled) return;
    let ctx: AudioContext | null = null;
    let raf = 0;
    try {
      ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (const n of data) sum += n;
        setOn(sum / data.length > 16);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    } catch {
      return;
    }
    return () => {
      cancelAnimationFrame(raf);
      void ctx?.close();
    };
  }, [stream, enabled]);
  return Boolean(stream && enabled && on);
}

export const MeetRoom = forwardRef<MeetRoomHandle, MeetRoomProps>(function MeetRoom(
  { lessonId, displayName, moderator },
  ref,
) {
  const peerIdRef = useRef(`p_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const pcs = useRef(new Map<string, RTCPeerConnection>());
  const names = useRef(new Map<string, PeerInfo>());
  const sinceRef = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const prevSpeakRef = useRef(Boolean(moderator));

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remotes, setRemotes] = useState<{ info: PeerInfo; stream: MediaStream | null }[]>([]);
  const [selfInfo, setSelfInfo] = useState<PeerInfo | null>(null);
  const [present, setPresent] = useState<PresentState>(null);
  const [pointer, setPointer] = useState({ on: false, x: 0.5, y: 0.5 });
  const [pointerOn, setPointerOn] = useState(false);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [error, setError] = useState("");
  const [micOn, setMicOn] = useState(Boolean(moderator));
  const [camOn, setCamOn] = useState(Boolean(moderator));
  const [handRaised, setHandRaised] = useState(false);
  const [focus, setFocus] = useState<Focus>("auto");
  const [panel, setPanel] = useState<"none" | "files" | "people" | "settings">("none");
  const [chatText, setChatText] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const lastPtrRef = useRef(0);
  const [assets, setAssets] = useState<{ id: string; fileName: string; fileUrl: string; mime: string }[]>([]);
  const [recording, setRecording] = useState(false);
  const [devices, setDevices] = useState<{ audio: MediaDeviceInfo[]; video: MediaDeviceInfo[] }>({
    audio: [],
    video: [],
  });
  const [notice, setNotice] = useState("");

  const localSpeaking = useSpeaking(localStream, micOn);
  const canSpeak = moderator || Boolean(selfInfo?.canSpeak);
  const allowCam = moderator || Boolean(selfInfo?.allowCam);

  const sendEvent = useCallback(
    (data: Record<string, unknown>) => {
      void api({
        lessonId,
        peerId: peerIdRef.current,
        name: displayName,
        action: "event",
        data,
      }).then((snap) => {
        if (snap.present !== undefined) setPresent(snap.present ?? null);
        if (snap.chat) setChat(snap.chat);
        if (snap.self) setSelfInfo(snap.self);
      });
    },
    [displayName, lessonId],
  );

  const uploadRecording = useCallback(async () => {
    const rec = recorderRef.current;
    if (rec && rec.state === "recording") rec.requestData();
    await new Promise((r) => window.setTimeout(r, 250));
    const blob = new Blob(chunksRef.current, { type: "video/webm" });
    if (blob.size < 8000) return null;
    const fd = new FormData();
    fd.append("file", blob, "lesson.webm");
    const res = await fetch(`/api/teacher/lessons/${lessonId}/recording`, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Yozuv yuklanmadi");
    return (data.url as string) || null;
  }, [lessonId]);

  useImperativeHandle(
    ref,
    () => ({
      presentFile: (file) => {
        sendEvent({ kind: "present", present: file });
        setFocus("content");
      },
      saveRecording: async () => {
        const rec = recorderRef.current;
        if (rec && rec.state !== "inactive") {
          await new Promise<void>((resolve) => {
            rec.onstop = () => resolve();
            rec.stop();
          });
        }
        recorderRef.current = null;
        setRecording(false);
        return uploadRecording();
      },
    }),
    [sendEvent, uploadRecording],
  );

  const upsertRemote = useCallback((id: string, stream: MediaStream) => {
    setRemotes((prev) => {
      const info = names.current.get(id) || {
        id,
        name: "Ishtirokchi",
        role: "student" as const,
        handRaised: false,
        canSpeak: false,
        allowCam: false,
        micOn: false,
        camOn: false,
      };
      const next = prev.filter((p) => p.info.id !== id);
      next.push({ info, stream });
      return next;
    });
  }, []);

  const dropRemote = useCallback((id: string) => {
    const pc = pcs.current.get(id);
    pc?.close();
    pcs.current.delete(id);
    names.current.delete(id);
    setRemotes((prev) => prev.filter((p) => p.info.id !== id));
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

  const outgoingStream = useCallback(() => screenStreamRef.current ?? localStreamRef.current, []);

  const ensurePc = useCallback(
    (otherId: string) => {
      const existing = pcs.current.get(otherId);
      if (existing) return existing;
      const pc = new RTCPeerConnection(ICE);
      pcs.current.set(otherId, pc);
      const local = outgoingStream();
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
    [dropRemote, outgoingStream, sendSignal, upsertRemote],
  );

  const replaceOutgoingVideo = useCallback(async (track: MediaStreamTrack | null) => {
    for (const pc of pcs.current.values()) {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video" || s.track == null);
      const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (track) await (videoSender ?? sender)?.replaceTrack(track);
    }
  }, []);

  const startRecorder = useCallback((stream: MediaStream) => {
    if (!moderator || typeof MediaRecorder === "undefined") return;
    try {
      const rec = new MediaRecorder(stream, recorderOptions());
      rec.ondataavailable = (ev) => {
        if (ev.data.size) chunksRef.current.push(ev.data);
      };
      rec.start(1500);
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      setRecording(false);
    }
  }, [moderator]);

  const switchRecorder = useCallback(
    async (stream: MediaStream) => {
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        await new Promise<void>((resolve) => {
          rec.onstop = () => resolve();
          rec.stop();
        });
      }
      startRecorder(stream);
    },
    [startRecorder],
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
        if (!moderator) {
          stream.getTracks().forEach((t) => {
            t.enabled = false;
          });
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
        await api({ lessonId, peerId, name: displayName, action: "join" });
        sendEvent({ kind: "state", micOn: Boolean(moderator), camOn: Boolean(moderator) });
        if (moderator) startRecorder(stream);
        const list = await navigator.mediaDevices.enumerateDevices();
        setDevices({
          audio: list.filter((d) => d.kind === "audioinput"),
          video: list.filter((d) => d.kind === "videoinput"),
        });
      } catch {
        try {
          await api({ lessonId, peerId, name: displayName, action: "join" });
        } catch {
          /* join without media */
        }
        if (!stopped) setError("Kameraga ruxsat berilmadi. Siz baribir xonadasiz — qo‘l ko‘tarib so‘rash mumkin.");
      }
    };

    void start();

    const poll = window.setInterval(async () => {
      if (stopped) return;
      try {
        const snap = await api({
          lessonId,
          peerId,
          name: displayName,
          action: "poll",
          since: sinceRef.current,
        });
        sinceRef.current = snap.since ?? sinceRef.current;
        setPresent(snap.present ?? null);
        if (snap.pointer) setPointer(snap.pointer);
        if (snap.chat) setChat(snap.chat);
        if (snap.self) setSelfInfo(snap.self);
        const liveIds = new Set((snap.peers ?? []).map((p) => p.id));
        for (const p of snap.peers ?? []) {
          names.current.set(p.id, p);
          if (peerIdRef.current < p.id) await callPeer(p.id);
          else ensurePc(p.id);
        }
        setRemotes((prev) => {
          const known = new Map(prev.map((r) => [r.info.id, r]));
          const next = (snap.peers ?? []).map((info) => ({
            info,
            stream: known.get(info.id)?.stream ?? null,
          }));
          return next;
        });
        for (const id of [...pcs.current.keys()]) {
          if (!liveIds.has(id)) dropRemote(id);
        }
        for (const msg of snap.messages ?? []) {
          if (msg.data.kind !== "offer" && msg.data.kind !== "answer" && msg.data.kind !== "ice") continue;
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
    }, 500);

    const connections = pcs.current;
    return () => {
      stopped = true;
      window.clearInterval(poll);
      void api({ lessonId, peerId, action: "leave" }).catch(() => undefined);
      connections.forEach((pc) => pc.close());
      connections.clear();
      recorderRef.current?.stop();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    };
  }, [callPeer, displayName, dropRemote, ensurePc, lessonId, moderator, sendEvent, sendSignal, startRecorder]);

  useEffect(() => {
    if (moderator || !selfInfo) return;
    const stream = localStreamRef.current;
    if (!stream) return;
    if (selfInfo.canSpeak && !prevSpeakRef.current) {
      stream.getAudioTracks().forEach((t) => {
        t.enabled = true;
      });
      queueMicrotask(() => {
        setMicOn(true);
        setHandRaised(false);
        setNotice("Ustoz mikrofonni ochdi — gapirishingiz mumkin.");
      });
      sendEvent({ kind: "state", micOn: true, camOn: false });
    }
    if (!selfInfo.canSpeak && prevSpeakRef.current) {
      stream.getAudioTracks().forEach((t) => {
        t.enabled = false;
      });
      stream.getVideoTracks().forEach((t) => {
        t.enabled = false;
      });
      queueMicrotask(() => {
        setMicOn(false);
        setCamOn(false);
      });
      sendEvent({ kind: "state", micOn: false, camOn: false });
    }
    if (!selfInfo.allowCam) {
      stream.getVideoTracks().forEach((t) => {
        t.enabled = false;
      });
      queueMicrotask(() => setCamOn(false));
    }
    prevSpeakRef.current = selfInfo.canSpeak;
  }, [moderator, selfInfo, sendEvent]);

  useEffect(() => {
    if (!moderator) return;
    const tick = window.setInterval(() => {
      void uploadRecording().catch(() => undefined);
    }, 20000);
    return () => window.clearInterval(tick);
  }, [moderator, uploadRecording]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [chat]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(t);
  }, [notice]);

  const toggleMic = () => {
    if (!canSpeak && !moderator) {
      const next = !handRaised;
      setHandRaised(next);
      sendEvent({ kind: "hand", handRaised: next });
      setNotice(next ? "Qo‘l ko‘tarildi — ustoz ruxsat bersa gapirasiz." : "Qo‘l tushirildi.");
      return;
    }
    const next = !micOn;
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = next;
    });
    setMicOn(next);
    sendEvent({ kind: "state", micOn: next, camOn });
  };

  const toggleCam = () => {
    if (!allowCam && !moderator) {
      setNotice("Kamerani ustoz ruxsat berganida yoqasiz.");
      return;
    }
    const next = !camOn;
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = next;
    });
    setCamOn(next);
    sendEvent({ kind: "state", micOn, camOn: next });
  };

  const toggleHand = () => {
    const next = !handRaised;
    setHandRaised(next);
    sendEvent({ kind: "hand", handRaised: next });
  };

  const grant = (targetId: string, mic: boolean, cam: boolean) => {
    sendEvent({ kind: "grant", targetId, mic, cam });
  };
  const revoke = (targetId: string) => {
    sendEvent({ kind: "revoke", targetId });
  };

  const stopShare = useCallback(async () => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setScreenStream(null);
    const cam = localStreamRef.current?.getVideoTracks()[0] ?? null;
    if (cam) await replaceOutgoingVideo(cam);
    if (localStreamRef.current) await switchRecorder(localStreamRef.current);
    setFocus("auto");
  }, [replaceOutgoingVideo, switchRecorder]);

  const shareScreen = async () => {
    if (!moderator) return;
    if (screenStreamRef.current) {
      await stopShare();
      return;
    }
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = screen;
      setScreenStream(screen);
      const track = screen.getVideoTracks()[0];
      await replaceOutgoingVideo(track);
      const mix = new MediaStream();
      mix.addTrack(track);
      localStreamRef.current?.getAudioTracks().forEach((t) => mix.addTrack(t));
      await switchRecorder(mix);
      setFocus("content");
      track.onended = () => {
        void stopShare();
      };
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setNotice("Ekran ulashilmasdan qoldi.");
    }
  };

  const loadAssets = async () => {
    if (!moderator) return;
    const res = await fetch(`/api/teacher/lessons/${lessonId}/assets`);
    const data = await res.json().catch(() => ({}));
    setAssets(data.items ?? []);
  };

  const uploadAsset = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/teacher/lessons/${lessonId}/assets`, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setNotice(data.error || "Yuklanmadi");
      return;
    }
    await loadAssets();
  };

  const presentAsset = (item: { fileUrl: string; fileName: string; mime: string }) => {
    sendEvent({ kind: "present", present: item });
    setFocus("content");
    setPanel("none");
  };

  const stopPresent = () => {
    sendEvent({ kind: "present", present: null });
    setFocus("teacher");
  };

  const sendChat = () => {
    const text = chatText.trim();
    if (!text) return;
    sendEvent({ kind: "chat", text });
    setChatText("");
    void fetch(`/api/lessons/${lessonId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  };

  const movePointer = (x: number, y: number) => {
    setPointer({ on: true, x, y });
    const now = Date.now();
    if (now - lastPtrRef.current < 80) return;
    lastPtrRef.current = now;
    sendEvent({ kind: "pointer", pointerOn: true, x, y });
  };

  const togglePointer = () => {
    const next = !pointerOn;
    setPointerOn(next);
    setPointer((p) => ({ ...p, on: next }));
    sendEvent({ kind: "pointer", pointerOn: next, x: pointer.x, y: pointer.y });
  };

  const fullscreen = () => {
    const el = document.querySelector(".meet-frame");
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen();
  };

  const changeDevice = async (kind: "audio" | "video", deviceId: string) => {
    const stream = await navigator.mediaDevices.getUserMedia(
      kind === "audio" ? { audio: { deviceId: { exact: deviceId } } } : { video: { deviceId: { exact: deviceId } } },
    );
    const nextTrack = kind === "audio" ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0];
    const local = localStreamRef.current;
    if (!local || !nextTrack) return;
    const old = kind === "audio" ? local.getAudioTracks()[0] : local.getVideoTracks()[0];
    if (old) {
      local.removeTrack(old);
      old.stop();
    }
    local.addTrack(nextTrack);
    setLocalStream(local.clone());
    for (const pc of pcs.current.values()) {
      const sender = pc.getSenders().find((s) => s.track?.kind === kind);
      await sender?.replaceTrack(nextTrack);
    }
    stream.getTracks().filter((t) => t !== nextTrack).forEach((t) => t.stop());
  };

  const teacherRemote = remotes.find((p) => p.info.role === "moderator");
  const teacherStream = moderator ? localStream : teacherRemote?.stream ?? null;
  const teacherName = moderator ? displayName : teacherRemote?.info.name || "Ustoz";
  const sharing = Boolean(screenStream);
  const hasContent = Boolean(present) || sharing;
  const stageKind =
    focus === "content" || (focus === "auto" && hasContent)
      ? "content"
      : focus === "self"
        ? "self"
        : focus === "teacher" || focus === "auto"
          ? "teacher"
          : "peer";
  const focusedPeer = stageKind === "peer" ? remotes.find((p) => p.info.id === focus) : null;
  const raisedCount = remotes.filter((p) => p.info.handRaised).length + (handRaised && !moderator ? 1 : 0);

  return (
    <div className="meet-frame" role="region" aria-label="Jonli dars xonasi">
      {error ? <p className="meet-error">{error}</p> : null}
      {notice ? (
        <p className="meet-notice">
          {notice}
          <button type="button" onClick={() => setNotice("")} aria-label="Yopish">
            ×
          </button>
        </p>
      ) : null}
      <div className="meet-zoom">
        <div className="meet-stage">
          {stageKind === "content" && present ? (
            <div className="meet-stage-main is-content">
              <PresentBoard
                present={present}
                pointer={pointerOn || pointer.on ? { on: true, x: pointer.x, y: pointer.y } : pointer}
                pointing={Boolean(moderator && pointerOn)}
                onPointer={movePointer}
              />
            </div>
          ) : null}
          {stageKind === "content" && sharing && !present ? (
            <div className="meet-stage-main is-content" onClick={() => setFocus("content")} role="button" tabIndex={0}>
              <video
                className="meet-slide-media"
                ref={(el) => {
                  if (el) el.srcObject = screenStream;
                }}
                autoPlay
                playsInline
                muted
              />
              <span className="meet-tile-name">Ekran</span>
            </div>
          ) : null}
          {stageKind === "teacher" ? (
            <VideoPane
              stream={teacherStream}
              name={teacherName}
              muted={moderator}
              you={moderator}
              speaking={moderator ? localSpeaking : teacherRemote?.info.micOn}
              micOff={moderator ? !micOn : teacherRemote ? !teacherRemote.info.micOn : false}
              camOff={moderator ? !camOn : teacherRemote ? !teacherRemote.info.camOn : false}
              onClick={() => setFocus("teacher")}
            />
          ) : null}
          {stageKind === "self" && !moderator ? (
            <VideoPane
              stream={localStream}
              name={displayName}
              muted
              you
              speaking={localSpeaking}
              hand={handRaised}
              micOff={!micOn}
              camOff={!camOn}
              onClick={() => setFocus("self")}
            />
          ) : null}
          {focusedPeer ? (
            <VideoPane
              stream={focusedPeer.stream}
              name={focusedPeer.info.name}
              speaking={focusedPeer.info.micOn}
              hand={focusedPeer.info.handRaised}
              micOff={!focusedPeer.info.micOn}
              camOff={!focusedPeer.info.camOn}
              onClick={() => setFocus(focusedPeer.info.id)}
            />
          ) : null}
          {stageKind === "content" ? (
            <div className="meet-pip">
              <VideoPane
                stream={teacherStream}
                name={teacherName}
                muted={moderator}
                you={moderator}
                compact
                camOff={moderator ? !camOn : teacherRemote ? !teacherRemote.info.camOn : false}
                onClick={() => setFocus("teacher")}
              />
            </div>
          ) : null}
        </div>
        <div className="meet-rail">
        <aside className="meet-strip" aria-label="Ishtirokchilar">
          {hasContent && stageKind !== "content" ? (
            <div className="meet-tile is-compact is-slide" onClick={() => setFocus("content")} role="button" tabIndex={0}>
              {present ? <PresentPane present={present} /> : <div className="meet-tile-empty">🖥</div>}
              <span className="meet-tile-name">{present ? present.fileName : "Ekran"}</span>
            </div>
          ) : null}
          {stageKind !== "teacher" ? (
            <VideoPane
              stream={teacherStream}
              name={teacherName}
              muted={moderator}
              you={moderator}
              compact
              speaking={moderator ? localSpeaking : undefined}
              micOff={moderator ? !micOn : teacherRemote ? !teacherRemote.info.micOn : false}
              camOff={moderator ? !camOn : teacherRemote ? !teacherRemote.info.camOn : false}
              onClick={() => setFocus("teacher")}
            />
          ) : null}
          {!moderator && stageKind !== "self" ? (
            <VideoPane
              stream={localStream}
              name={displayName}
              muted
              you
              compact
              speaking={localSpeaking}
              hand={handRaised}
              micOff={!micOn}
              camOff={!camOn}
              onClick={() => setFocus("self")}
            />
          ) : null}
          {remotes
            .filter((p) => p.info.role !== "moderator")
            .filter((p) => p.info.id !== focus)
            .map((p) => (
              <div key={p.info.id} className="meet-strip-item">
                <VideoPane
                  stream={p.stream}
                  name={p.info.name}
                  compact
                  speaking={p.info.micOn}
                  hand={p.info.handRaised}
                  micOff={!p.info.micOn}
                  camOff={!p.info.camOn}
                  onClick={() => setFocus(p.info.id)}
                />
                {moderator && p.info.role === "student" ? (
                  <div className="meet-grant">
                    {p.info.handRaised || !p.info.canSpeak ? (
                      <>
                        <button type="button" title="Mikrofon" onClick={(e) => { e.stopPropagation(); grant(p.info.id, true, false); }}>
                          Mic
                        </button>
                        <button type="button" title="Kamera" onClick={(e) => { e.stopPropagation(); grant(p.info.id, true, true); }}>
                          Cam
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={(e) => { e.stopPropagation(); revoke(p.info.id); }}>
                        To‘xtat
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            ))}
        </aside>
        <aside className="meet-chat-dock" aria-label="Jonli chat">
          <div className="meet-chat-head">Jonli chat</div>
          <div className="meet-chat-list">
            {chat.length === 0 ? <p className="small muted">Hali xabar yo‘q. Yozing — hammaga ko‘rinadi.</p> : null}
            {chat.map((line) => (
              <p key={line.id}>
                <strong>{line.name}: </strong>
                {line.text}
              </p>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="meet-chat-send">
            <input
              ref={chatInputRef}
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendChat();
              }}
              placeholder="Xabar yozing..."
            />
            <button className="btn btn-sm btn-primary" type="button" onClick={sendChat}>
              Yubor
            </button>
          </div>
        </aside>
        </div>
      </div>

      {panel !== "none" ? (
        <div className="meet-drawer">
          <div className="meet-drawer-head">
            <strong>
              {panel === "files" ? "Fayllar" : panel === "people" ? "Ishtirokchilar" : "Sozlama"}
            </strong>
            <button type="button" className="meet-icon-btn" onClick={() => setPanel("none")}>
              <Icon name="x" size={16} />
            </button>
          </div>
          {panel === "files" && moderator ? (
            <div className="meet-files">
              <label className="btn btn-sm">
                Fayl yuklash
                <input
                  type="file"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadAsset(file);
                    e.target.value = "";
                  }}
                />
              </label>
              {present ? (
                <button className="btn btn-sm" type="button" onClick={stopPresent}>
                  Namoyishni to‘xtat
                </button>
              ) : null}
              <ul>
                {assets.map((item) => (
                  <li key={item.id}>
                    <span>{item.fileName}</span>
                    <button className="btn btn-sm" type="button" onClick={() => presentAsset(item)}>
                      Namoyish
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {panel === "people" ? (
            <ul className="meet-people">
              <li>
                {displayName} (siz){handRaised ? " ✋" : ""}
              </li>
              {remotes.map((p) => (
                <li key={p.info.id}>
                  {p.info.name}
                  {p.info.role === "moderator" ? " · ustoz" : ""}
                  {p.info.handRaised ? " ✋" : ""}
                  {p.info.canSpeak ? " · gapirmoqda" : ""}
                  {moderator && p.info.role === "student" ? (
                    <span className="meet-grant">
                      <button type="button" onClick={() => grant(p.info.id, true, false)}>
                        Mic
                      </button>
                      <button type="button" onClick={() => grant(p.info.id, true, true)}>
                        Cam
                      </button>
                      <button type="button" onClick={() => revoke(p.info.id)}>
                        To‘xtat
                      </button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {panel === "settings" ? (
            <div className="meet-settings">
              <label>
                Mikrofon
                <select onChange={(e) => void changeDevice("audio", e.target.value)}>
                  {devices.audio.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || "Mikrofon"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Kamera
                <select onChange={(e) => void changeDevice("video", e.target.value)}>
                  {devices.video.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || "Kamera"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="meet-bar">
        <span className="meet-bar-meta">
          {recording ? <span className="meet-rec">REC</span> : null}
          {moderator ? "Ustoz" : "Talaba"} · {remotes.length + 1} kishi
          {raisedCount ? ` · ${raisedCount} qo‘l` : ""}
        </span>
        <div className="meet-bar-actions">
          <button
            className={`meet-icon-btn${micOn ? "" : " is-off"}`}
            type="button"
            title={canSpeak ? "Mikrofon" : "Qo‘l ko‘tarish"}
            onClick={toggleMic}
          >
            <Icon name={micOn ? "mic" : "micoff"} size={18} />
          </button>
          <button
            className={`meet-icon-btn${camOn ? "" : " is-off"}`}
            type="button"
            title="Kamera"
            onClick={toggleCam}
          >
            <Icon name={camOn ? "video" : "videooff"} size={18} />
          </button>
          {!moderator ? (
            <button
              className={`meet-icon-btn${handRaised ? " is-active" : ""}`}
              type="button"
              title="Qo‘l ko‘tarish"
              onClick={toggleHand}
            >
              <Icon name="hand" size={18} />
            </button>
          ) : null}
          {moderator ? (
            <>
              <button
                className={`meet-icon-btn${sharing ? " is-active" : ""}`}
                type="button"
                title="Ekranni ulashish"
                onClick={() => void shareScreen()}
              >
                <Icon name="screen" size={18} />
              </button>
              <button
                className="meet-icon-btn"
                type="button"
                title="Slayd / fayl"
                onClick={() => {
                  setPanel(panel === "files" ? "none" : "files");
                  void loadAssets();
                }}
              >
                <Icon name="file" size={18} />
              </button>
              <button
                className={`meet-icon-btn${pointerOn ? " is-active" : ""}`}
                type="button"
                title="Tayoqcha"
                onClick={togglePointer}
              >
                <Icon name="pointer" size={18} />
              </button>
            </>
          ) : null}
          <button
            className="meet-icon-btn"
            type="button"
            title="Chat"
            onClick={() => chatInputRef.current?.focus()}
          >
            <Icon name="chat" size={18} />
          </button>
          <button
            className={`meet-icon-btn${panel === "people" ? " is-active" : ""}`}
            type="button"
            title="Ishtirokchilar"
            onClick={() => setPanel(panel === "people" ? "none" : "people")}
          >
            <Icon name="users" size={18} />
          </button>
          <button className="meet-icon-btn" type="button" title="To‘liq ekran" onClick={fullscreen}>
            <Icon name="maximize" size={18} />
          </button>
          <button
            className={`meet-icon-btn${panel === "settings" ? " is-active" : ""}`}
            type="button"
            title="Sozlama"
            onClick={() => setPanel(panel === "settings" ? "none" : "settings")}
          >
            <Icon name="settings" size={18} />
          </button>
        </div>
      </div>
    </div>
  );
});
