export type PeerRole = "moderator" | "student";

export type LivePeer = {
  id: string;
  name: string;
  role: PeerRole;
  handRaised: boolean;
  canSpeak: boolean;
  allowCam: boolean;
  micOn: boolean;
  camOn: boolean;
};

export type PresentState = {
  fileUrl: string;
  fileName: string;
  mime: string;
} | null;

export type ChatLine = { id: number; from: string; name: string; text: string };

export type SignalPayload = {
  kind: "offer" | "answer" | "ice" | "hand" | "grant" | "revoke" | "present" | "chat" | "state";
  sdp?: string;
  candidate?: {
    candidate?: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
  } | null;
  handRaised?: boolean;
  targetId?: string;
  mic?: boolean;
  cam?: boolean;
  present?: PresentState;
  text?: string;
  micOn?: boolean;
  camOn?: boolean;
};

export type LiveSignal = { id: number; from: string; to: string; data: SignalPayload };

type PeerRow = LivePeer & { lastSeen: number };

type RoomState = {
  peers: Map<string, PeerRow>;
  messages: LiveSignal[];
  chat: ChatLine[];
  present: PresentState;
  seq: number;
  chatSeq: number;
};

const g = globalThis as typeof globalThis & { __tdyuLiveRooms?: Map<string, RoomState> };
const rooms = g.__tdyuLiveRooms ?? new Map<string, RoomState>();
g.__tdyuLiveRooms = rooms;

const PEER_TTL_MS = 20_000;
const MAX_MESSAGES = 500;

function room(lessonId: string) {
  let state = rooms.get(lessonId);
  if (!state) {
    state = { peers: new Map(), messages: [], chat: [], present: null, seq: 0, chatSeq: 0 };
    rooms.set(lessonId, state);
  }
  return state;
}

function prune(state: RoomState) {
  const now = Date.now();
  for (const [id, peer] of state.peers) {
    if (now - peer.lastSeen > PEER_TTL_MS) state.peers.delete(id);
  }
  if (state.messages.length > MAX_MESSAGES) {
    state.messages = state.messages.slice(-MAX_MESSAGES);
  }
}

function publicPeer(p: PeerRow): LivePeer {
  return {
    id: p.id,
    name: p.name,
    role: p.role,
    handRaised: p.handRaised,
    canSpeak: p.canSpeak,
    allowCam: p.allowCam,
    micOn: p.micOn,
    camOn: p.camOn,
  };
}

export function snapshot(state: RoomState, peerId: string, since: number) {
  prune(state);
  const peers: LivePeer[] = [];
  for (const [id, peer] of state.peers) {
    if (id !== peerId) peers.push(publicPeer(peer));
  }
  const self = state.peers.get(peerId);
  const messages = state.messages.filter((m) => m.id > since && (m.to === peerId || m.to === "*"));
  return {
    peers,
    self: self ? publicPeer(self) : null,
    messages,
    present: state.present,
    chat: state.chat.slice(-40),
    since: state.seq,
  };
}

export function joinLivePeer(
  lessonId: string,
  peerId: string,
  name: string,
  role: PeerRole,
) {
  const state = room(lessonId);
  prune(state);
  const isMod = role === "moderator";
  state.peers.set(peerId, {
    id: peerId,
    name: name.trim().slice(0, 80) || "Mehmon",
    role,
    handRaised: false,
    canSpeak: isMod,
    allowCam: isMod,
    micOn: isMod,
    camOn: isMod,
    lastSeen: Date.now(),
  });
  return snapshot(state, peerId, 0);
}

export function leaveLivePeer(lessonId: string, peerId: string) {
  const state = rooms.get(lessonId);
  if (!state) return;
  state.peers.delete(peerId);
}

export function pushLiveSignal(lessonId: string, from: string, to: string, data: SignalPayload) {
  const state = room(lessonId);
  prune(state);
  const peer = state.peers.get(from);
  if (peer) peer.lastSeen = Date.now();
  state.seq += 1;
  state.messages.push({ id: state.seq, from, to, data });
}

export function applyRoomEvent(lessonId: string, from: string, data: SignalPayload) {
  const state = room(lessonId);
  prune(state);
  const me = state.peers.get(from);
  if (!me) return snapshot(state, from, state.seq);

  if (data.kind === "hand") {
    me.handRaised = Boolean(data.handRaised);
    pushLiveSignal(lessonId, from, "*", { kind: "hand", handRaised: me.handRaised, targetId: from });
  }

  if (data.kind === "state") {
    me.micOn = Boolean(data.micOn);
    me.camOn = Boolean(data.camOn);
    pushLiveSignal(lessonId, from, "*", { kind: "state", targetId: from, micOn: me.micOn, camOn: me.camOn });
  }

  if (data.kind === "grant" && me.role === "moderator" && data.targetId) {
    const target = state.peers.get(data.targetId);
    if (target) {
      if (data.mic) {
        target.canSpeak = true;
        target.handRaised = false;
      }
      if (data.cam) target.allowCam = true;
      pushLiveSignal(lessonId, from, "*", {
        kind: "grant",
        targetId: target.id,
        mic: target.canSpeak,
        cam: target.allowCam,
      });
    }
  }

  if (data.kind === "revoke" && me.role === "moderator" && data.targetId) {
    const target = state.peers.get(data.targetId);
    if (target && target.role !== "moderator") {
      target.canSpeak = false;
      target.allowCam = false;
      target.micOn = false;
      target.camOn = false;
      pushLiveSignal(lessonId, from, "*", { kind: "revoke", targetId: target.id });
    }
  }

  if (data.kind === "present" && me.role === "moderator") {
    state.present = data.present ?? null;
    pushLiveSignal(lessonId, from, "*", { kind: "present", present: state.present });
  }

  if (data.kind === "chat" && data.text) {
    const text = data.text.trim().slice(0, 400);
    if (text) {
      state.chatSeq += 1;
      state.chat.push({ id: state.chatSeq, from, name: me.name, text });
      if (state.chat.length > 80) state.chat = state.chat.slice(-80);
      pushLiveSignal(lessonId, from, "*", { kind: "chat", text, targetId: from });
    }
  }

  return snapshot(state, from, 0);
}

export function pollLiveRoom(lessonId: string, peerId: string, since: number) {
  const state = room(lessonId);
  const existing = state.peers.get(peerId);
  if (existing) existing.lastSeen = Date.now();
  return snapshot(state, peerId, since);
}

export function closeLiveRoom(lessonId: string) {
  rooms.delete(lessonId);
}
