/**
 * Phase 7 Live Wave 2 — A/V permission policy (pure helpers).
 *
 * NONE → REQUESTED (raise hand) → GRANTED → REVOKED
 * Teacher mute / camera-off are separate enforced flags while GRANTED.
 */

export type AvPermission = "none" | "requested" | "granted" | "revoked";

export type AvPeerFlags = {
  avPermission: AvPermission;
  canSpeak: boolean;
  allowCam: boolean;
  teacherMuted: boolean;
  teacherCamOff: boolean;
  micOn: boolean;
  camOn: boolean;
  handRaised: boolean;
};

export function initialStudentAvFlags(): AvPeerFlags {
  return {
    avPermission: "none",
    canSpeak: false,
    allowCam: false,
    teacherMuted: false,
    teacherCamOff: false,
    micOn: false,
    camOn: false,
    handRaised: false,
  };
}

export function initialModeratorAvFlags(): AvPeerFlags {
  return {
    avPermission: "granted",
    canSpeak: true,
    allowCam: true,
    teacherMuted: false,
    teacherCamOff: false,
    micOn: true,
    camOn: true,
    handRaised: false,
  };
}

/** Student raise hand → REQUESTED (does not grant A/V). */
export function applyRaiseHand(flags: AvPeerFlags, raised: boolean): AvPeerFlags {
  if (!raised) {
    return {
      ...flags,
      handRaised: false,
      avPermission: flags.avPermission === "requested" ? "none" : flags.avPermission,
    };
  }
  if (flags.avPermission === "granted") {
    return { ...flags, handRaised: true };
  }
  return {
    ...flags,
    handRaised: true,
    avPermission: "requested",
  };
}

/** Teacher grant — permission only; does NOT force mic/cam ON. */
export function applyGrant(
  flags: AvPeerFlags,
  opts: { mic: boolean; cam: boolean },
): AvPeerFlags {
  const mic = Boolean(opts.mic);
  const cam = Boolean(opts.cam);
  return {
    ...flags,
    avPermission: "granted",
    canSpeak: mic,
    allowCam: cam,
    handRaised: false,
    teacherMuted: mic ? false : flags.teacherMuted,
    teacherCamOff: cam ? false : flags.teacherCamOff,
    // Explicit: do not auto-enable devices
    micOn: false,
    camOn: false,
  };
}

export function applyRevoke(flags: AvPeerFlags): AvPeerFlags {
  return {
    ...flags,
    avPermission: "revoked",
    canSpeak: false,
    allowCam: false,
    teacherMuted: false,
    teacherCamOff: false,
    micOn: false,
    camOn: false,
    handRaised: false,
  };
}

export function applyTeacherMute(flags: AvPeerFlags): AvPeerFlags {
  return { ...flags, teacherMuted: true, micOn: false };
}

export function applyTeacherCameraOff(flags: AvPeerFlags): AvPeerFlags {
  return { ...flags, teacherCamOff: true, camOn: false };
}

/**
 * Clamp student-reported local A/V state to server permission.
 * Moderator is not clamped.
 */
export function clampStudentPublishState(
  flags: AvPeerFlags,
  want: { micOn: boolean; camOn: boolean },
  isModerator: boolean,
): { micOn: boolean; camOn: boolean } {
  if (isModerator) {
    return { micOn: Boolean(want.micOn), camOn: Boolean(want.camOn) };
  }
  const micOn =
    Boolean(want.micOn) &&
    flags.avPermission === "granted" &&
    flags.canSpeak &&
    !flags.teacherMuted;
  const camOn =
    Boolean(want.camOn) &&
    flags.avPermission === "granted" &&
    flags.allowCam &&
    !flags.teacherCamOff;
  return { micOn, camOn };
}

export function studentMayPublishMic(flags: AvPeerFlags): boolean {
  return flags.avPermission === "granted" && flags.canSpeak && !flags.teacherMuted;
}

export function studentMayPublishCam(flags: AvPeerFlags): boolean {
  return flags.avPermission === "granted" && flags.allowCam && !flags.teacherCamOff;
}

export function avStatusLabelUz(flags: AvPeerFlags): string {
  if (flags.teacherMuted) return "Mikrofon o‘qituvchi tomonidan o‘chirildi";
  if (flags.teacherCamOff && !flags.allowCam) return "Kamera o‘qituvchi tomonidan o‘chirildi";
  if (flags.teacherCamOff) return "Kamera o‘qituvchi tomonidan o‘chirildi";
  switch (flags.avPermission) {
    case "requested":
      return "Ruxsat so‘raldi";
    case "granted":
      return "Ruxsat berildi";
    case "revoked":
      return "Ruxsat bekor qilindi";
    default:
      return "Ruxsat yo‘q";
  }
}
