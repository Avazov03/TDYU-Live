/**
 * In-memory live room + signaling (poll-based).
 * Wave 2: A/V permission is session-scoped here (not DB) — see live-av-policy.ts.
 */

import {
  applyGrant,
  applyRaiseHand,
  applyRevoke,
  applyTeacherCameraOff,
  applyTeacherMute,
  clampStudentPublishState,
  initialModeratorAvFlags,
  initialStudentAvFlags,
  type AvPermission,
} from "@/lib/live-av-policy";

export type PeerRole = "moderator" | "student";

export type LivePeer = {
  id: string;
  name: string;
  role: PeerRole;
  avPermission: AvPermission;
  handRaised: boolean;
  canSpeak: boolean;
  allowCam: boolean;
  teacherMuted: boolean;
  teacherCamOff: boolean;
  micOn: boolean;
  camOn: boolean;
};

export type PresentState = {
  fileUrl: string;
  fileName: string;
  mime: string;
} | null;

export type PointerState = { on: boolean; x: number; y: number };

export type ChatLine = { id: number; from: string; name: string; text: string };

export type SignalPayload = {
  kind:
    | "offer"
    | "answer"
    | "ice"
    | "hand"
    | "grant"
    | "revoke"
    | "mute"
    | "camera_off"
    | "present"
    | "chat"
    | "state"
    | "pointer";
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
  pointerOn?: boolean;
  x?: number;
  y?: number;
  avPermission?: AvPermission;
  teacherMuted?: boolean;
  teacherCamOff?: boolean;
};

export type LiveSignal = { id: number; from: string; to: string; data: SignalPayload };

type PeerRow = LivePeer & { lastSeen: number };

type RoomState = {
  peers: Map<string, PeerRow>;
  messages: LiveSignal[];
  chat: ChatLine[];
  present: PresentState;
  pointer: PointerState;
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
    state = {
      peers: new Map(),
      messages: [],
      chat: [],
      present: null,
      pointer: { on: false, x: 0.5, y: 0.5 },
      seq: 0,
      chatSeq: 0,
    };
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
    avPermission: p.avPermission,
    handRaised: p.handRaised,
    canSpeak: p.canSpeak,
    allowCam: p.allowCam,
    teacherMuted: p.teacherMuted,
    teacherCamOff: p.teacherCamOff,
    micOn: p.micOn,
    camOn: p.camOn,
  };
}

function flagsFromPeer(p: PeerRow) {
  return {
    avPermission: p.avPermission,
    canSpeak: p.canSpeak,
    allowCam: p.allowCam,
    teacherMuted: p.teacherMuted,
    teacherCamOff: p.teacherCamOff,
    micOn: p.micOn,
    camOn: p.camOn,
    handRaised: p.handRaised,
  };
}

function applyFlagsToPeer(p: PeerRow, flags: ReturnType<typeof flagsFromPeer>) {
  p.avPermission = flags.avPermission;
  p.canSpeak = flags.canSpeak;
  p.allowCam = flags.allowCam;
  p.teacherMuted = flags.teacherMuted;
  p.teacherCamOff = flags.teacherCamOff;
  p.micOn = flags.micOn;
  p.camOn = flags.camOn;
  p.handRaised = flags.handRaised;
}

function pushPeerAvBroadcast(lessonId: string, from: string, target: PeerRow, kind: SignalPayload["kind"]) {
  pushLiveSignal(lessonId, from, "*", {
    kind,
    targetId: target.id,
    mic: target.canSpeak,
    cam: target.allowCam,
    micOn: target.micOn,
    camOn: target.camOn,
    handRaised: target.handRaised,
    avPermission: target.avPermission,
    teacherMuted: target.teacherMuted,
    teacherCamOff: target.teacherCamOff,
  });
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
    pointer: state.pointer,
    chat: state.chat.slice(-80),
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
  const existing = state.peers.get(peerId);
  if (existing) {
    existing.name = name.trim().slice(0, 80) || existing.name;
    existing.role = role;
    existing.lastSeen = Date.now();
    // Preserve A/V permission flags on re-join (Wave 2).
    return snapshot(state, peerId, 0);
  }
  const isMod = role === "moderator";
  const flags = isMod ? initialModeratorAvFlags() : initialStudentAvFlags();
  state.peers.set(peerId, {
    id: peerId,
    name: name.trim().slice(0, 80) || "Mehmon",
    role,
    ...flags,
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

export type AvControlAction =
  | "raise_hand"
  | "lower_hand"
  | "grant"
  | "revoke"
  | "mute"
  | "camera_off";

export type AvControlResult =
  | { ok: true; snap: ReturnType<typeof snapshot> }
  | { ok: false; code: string; message: string };

/**
 * Server-side A/V control (Wave 2). Caller must already authorize the actor.
 * Actor is identified by stable peerId (u_<userId>).
 */
export function applyAvControl(input: {
  lessonId: string;
  actorPeerId: string;
  action: AvControlAction;
  targetPeerId?: string;
  mic?: boolean;
  cam?: boolean;
}): AvControlResult {
  const state = room(input.lessonId);
  prune(state);
  const me = state.peers.get(input.actorPeerId);
  if (!me) {
    return { ok: false, code: "NOT_IN_ROOM", message: "Xonaga kirmagan" };
  }
  me.lastSeen = Date.now();

  if (input.action === "raise_hand" || input.action === "lower_hand") {
    if (me.role === "moderator") {
      return { ok: false, code: "MODERATOR_NO_HAND", message: "Ustoz qo‘l ko‘tarmaydi" };
    }
    const raised = input.action === "raise_hand";
    applyFlagsToPeer(me, applyRaiseHand(flagsFromPeer(me), raised));
    pushPeerAvBroadcast(input.lessonId, input.actorPeerId, me, "hand");
    return { ok: true, snap: snapshot(state, input.actorPeerId, 0) };
  }

  if (me.role !== "moderator") {
    return { ok: false, code: "NOT_MODERATOR", message: "Faqat ustoz" };
  }

  const targetId = input.targetPeerId;
  if (!targetId) {
    return { ok: false, code: "NO_TARGET", message: "Ishtirokchi tanlanmagan" };
  }
  if (targetId === input.actorPeerId) {
    return { ok: false, code: "SELF_TARGET", message: "O‘zingizga qo‘llab bo‘lmaydi" };
  }
  const target = state.peers.get(targetId);
  if (!target) {
    return { ok: false, code: "TARGET_NOT_FOUND", message: "Ishtirokchi topilmadi" };
  }
  if (target.role === "moderator") {
    return { ok: false, code: "TARGET_MODERATOR", message: "Ustozni boshqarib bo‘lmaydi" };
  }

  if (input.action === "grant") {
    // Default full A/V grant when mic/cam omitted (teacher "Grant A/V").
    const mic = input.mic ?? true;
    const cam = input.cam ?? true;
    applyFlagsToPeer(target, applyGrant(flagsFromPeer(target), { mic, cam }));
    pushPeerAvBroadcast(input.lessonId, input.actorPeerId, target, "grant");
    return { ok: true, snap: snapshot(state, input.actorPeerId, 0) };
  }

  if (input.action === "revoke") {
    applyFlagsToPeer(target, applyRevoke(flagsFromPeer(target)));
    pushPeerAvBroadcast(input.lessonId, input.actorPeerId, target, "revoke");
    return { ok: true, snap: snapshot(state, input.actorPeerId, 0) };
  }

  if (input.action === "mute") {
    applyFlagsToPeer(target, applyTeacherMute(flagsFromPeer(target)));
    pushPeerAvBroadcast(input.lessonId, input.actorPeerId, target, "mute");
    return { ok: true, snap: snapshot(state, input.actorPeerId, 0) };
  }

  if (input.action === "camera_off") {
    applyFlagsToPeer(target, applyTeacherCameraOff(flagsFromPeer(target)));
    pushPeerAvBroadcast(input.lessonId, input.actorPeerId, target, "camera_off");
    return { ok: true, snap: snapshot(state, input.actorPeerId, 0) };
  }

  return { ok: false, code: "UNKNOWN_ACTION", message: "Noma’lum amal" };
}

export function applyRoomEvent(lessonId: string, from: string, data: SignalPayload) {
  const state = room(lessonId);
  prune(state);
  const me = state.peers.get(from);
  if (!me) return snapshot(state, from, state.seq);

  if (data.kind === "hand") {
    if (me.role !== "moderator") {
      applyFlagsToPeer(me, applyRaiseHand(flagsFromPeer(me), Boolean(data.handRaised)));
      pushPeerAvBroadcast(lessonId, from, me, "hand");
    }
  }

  if (data.kind === "state") {
    const clamped = clampStudentPublishState(
      flagsFromPeer(me),
      { micOn: Boolean(data.micOn), camOn: Boolean(data.camOn) },
      me.role === "moderator",
    );
    me.micOn = clamped.micOn;
    me.camOn = clamped.camOn;
    pushLiveSignal(lessonId, from, "*", {
      kind: "state",
      targetId: from,
      micOn: me.micOn,
      camOn: me.camOn,
      avPermission: me.avPermission,
      teacherMuted: me.teacherMuted,
      teacherCamOff: me.teacherCamOff,
    });
  }

  if (data.kind === "grant" && me.role === "moderator" && data.targetId) {
    const result = applyAvControl({
      lessonId,
      actorPeerId: from,
      action: "grant",
      targetPeerId: data.targetId,
      mic: data.mic,
      cam: data.cam,
    });
    if (result.ok) return result.snap;
  }

  if (data.kind === "revoke" && me.role === "moderator" && data.targetId) {
    const result = applyAvControl({
      lessonId,
      actorPeerId: from,
      action: "revoke",
      targetPeerId: data.targetId,
    });
    if (result.ok) return result.snap;
  }

  if (data.kind === "mute" && me.role === "moderator" && data.targetId) {
    const result = applyAvControl({
      lessonId,
      actorPeerId: from,
      action: "mute",
      targetPeerId: data.targetId,
    });
    if (result.ok) return result.snap;
  }

  if (data.kind === "camera_off" && me.role === "moderator" && data.targetId) {
    const result = applyAvControl({
      lessonId,
      actorPeerId: from,
      action: "camera_off",
      targetPeerId: data.targetId,
    });
    if (result.ok) return result.snap;
  }

  if (data.kind === "present" && me.role === "moderator") {
    state.present = data.present ?? null;
    if (!state.present) state.pointer = { on: false, x: 0.5, y: 0.5 };
    pushLiveSignal(lessonId, from, "*", { kind: "present", present: state.present });
  }

  if (data.kind === "pointer" && me.role === "moderator") {
    const x = Math.min(1, Math.max(0, Number(data.x) || 0));
    const y = Math.min(1, Math.max(0, Number(data.y) || 0));
    state.pointer = { on: Boolean(data.pointerOn), x, y };
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

/** Test helper — wipe all rooms. */
export function __resetLiveRoomsForTests() {
  rooms.clear();
}
