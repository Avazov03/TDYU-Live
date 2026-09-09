type SignalPayload = {
  kind: "offer" | "answer" | "ice";
  sdp?: string;
  candidate?: {
    candidate?: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
  } | null;
};

export type LivePeer = { id: string; name: string };
export type LiveSignal = { id: number; from: string; to: string; data: SignalPayload };

type RoomState = {
  peers: Map<string, { name: string; lastSeen: number }>;
  messages: LiveSignal[];
  seq: number;
};

const g = globalThis as typeof globalThis & { __tdyuLiveRooms?: Map<string, RoomState> };
const rooms = g.__tdyuLiveRooms ?? new Map<string, RoomState>();
g.__tdyuLiveRooms = rooms;

const PEER_TTL_MS = 20_000;
const MAX_MESSAGES = 400;

function room(lessonId: string) {
  let state = rooms.get(lessonId);
  if (!state) {
    state = { peers: new Map(), messages: [], seq: 0 };
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

export function joinLivePeer(lessonId: string, peerId: string, name: string): { peers: LivePeer[] } {
  const state = room(lessonId);
  prune(state);
  state.peers.set(peerId, { name: name.trim().slice(0, 80) || "Mehmon", lastSeen: Date.now() });
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

export function snapshot(state: RoomState, peerId: string, since: number) {
  prune(state);
  const peers: LivePeer[] = [];
  for (const [id, peer] of state.peers) {
    if (id !== peerId) peers.push({ id, name: peer.name });
  }
  const messages = state.messages.filter((m) => m.id > since && m.to === peerId);
  return { peers, messages, since: state.seq };
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
