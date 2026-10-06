/**
 * Server-authoritative 60-minute teaching clock.
 * Pause and teacher-disconnect gaps are not teaching time.
 */

export const TEACHING_LIMIT_SEC = 60 * 60;
export const DISCONNECT_GAP_SEC = 20;
export const WARN_55_SEC = 55 * 60;
export const WARN_58_SEC = 58 * 60;
export const WARN_59_SEC = 59 * 60;

export type TeachingClockStatus = "live" | "paused" | "ended" | "waiting" | "created" | "abandoned";

export type TeachingClockInput = {
  status: TeachingClockStatus;
  activeTeachingSeconds: number;
  pauseSeconds: number;
  lastTeacherBeatAt: Date | null;
  manualPause: boolean;
  now: Date;
  actor: "teacher" | "observer";
  warn55Sent: boolean;
  warn58Sent: boolean;
  warn59Sent: boolean;
};

export type TeachingClockResult = {
  status: TeachingClockStatus;
  activeTeachingSeconds: number;
  pauseSeconds: number;
  lastTeacherBeatAt: Date | null;
  manualPause: boolean;
  warn55Sent: boolean;
  warn58Sent: boolean;
  warn59Sent: boolean;
  warning: 55 | 58 | 59 | null;
  autoEnd: boolean;
  remainingSec: number;
  projectedTeachingSeconds: number;
};

function gapSec(last: Date | null, now: Date): number {
  if (!last) return 0;
  return Math.max(0, Math.floor((now.getTime() - last.getTime()) / 1000));
}

function withWarnings(
  teaching: number,
  input: TeachingClockInput,
): { warn55Sent: boolean; warn58Sent: boolean; warn59Sent: boolean; warning: 55 | 58 | 59 | null } {
  let warning: 55 | 58 | 59 | null = null;
  const warn55Sent = input.warn55Sent || teaching >= WARN_55_SEC;
  const warn58Sent = input.warn58Sent || teaching >= WARN_58_SEC;
  const warn59Sent = input.warn59Sent || teaching >= WARN_59_SEC;
  if (!input.warn59Sent && warn59Sent) warning = 59;
  else if (!input.warn58Sent && warn58Sent) warning = 58;
  else if (!input.warn55Sent && warn55Sent) warning = 55;
  return { warn55Sent, warn58Sent, warn59Sent, warning };
}

export function projectTeachingSeconds(input: {
  status: TeachingClockStatus;
  activeTeachingSeconds: number;
  lastTeacherBeatAt: Date | null;
  manualPause: boolean;
  now: Date;
}): number {
  if (input.manualPause || input.status !== "live" || !input.lastTeacherBeatAt) {
    return input.activeTeachingSeconds;
  }
  const gap = gapSec(input.lastTeacherBeatAt, input.now);
  if (gap > DISCONNECT_GAP_SEC) return input.activeTeachingSeconds;
  return input.activeTeachingSeconds + gap;
}

export function advanceTeachingClock(input: TeachingClockInput): TeachingClockResult {
  const idle = input.status === "ended" || input.status === "abandoned" || input.status === "waiting" || input.status === "created";
  if (idle) {
    return {
      status: input.status,
      activeTeachingSeconds: input.activeTeachingSeconds,
      pauseSeconds: input.pauseSeconds,
      lastTeacherBeatAt: input.lastTeacherBeatAt,
      manualPause: input.manualPause,
      warn55Sent: input.warn55Sent,
      warn58Sent: input.warn58Sent,
      warn59Sent: input.warn59Sent,
      warning: null,
      autoEnd: false,
      remainingSec: Math.max(0, TEACHING_LIMIT_SEC - input.activeTeachingSeconds),
      projectedTeachingSeconds: input.activeTeachingSeconds,
    };
  }

  let status = input.status;
  let teaching = input.activeTeachingSeconds;
  let pause = input.pauseSeconds;
  let beat = input.lastTeacherBeatAt;
  let manual = input.manualPause;
  const gap = gapSec(beat, input.now);

  if (manual && status === "paused") {
    if (gap > 0) pause += gap;
    beat = input.now;
  } else if (input.actor === "teacher") {
    if (!beat) {
      status = "live";
      manual = false;
      beat = input.now;
    } else if (gap > DISCONNECT_GAP_SEC || status === "paused") {
      pause += gap;
      status = "live";
      manual = false;
      beat = input.now;
    } else {
      teaching += gap;
      status = "live";
      manual = false;
      beat = input.now;
    }
  } else if (status === "live" && beat && gap > DISCONNECT_GAP_SEC) {
    status = "paused";
    manual = false;
  }

  const projected = projectTeachingSeconds({
    status,
    activeTeachingSeconds: teaching,
    lastTeacherBeatAt: beat,
    manualPause: manual,
    now: input.now,
  });
  const marks = withWarnings(projected, input);
  const autoEnd = projected >= TEACHING_LIMIT_SEC;
  if (autoEnd) {
    teaching = TEACHING_LIMIT_SEC;
    status = "ended";
  }

  return {
    status,
    activeTeachingSeconds: teaching,
    pauseSeconds: pause,
    lastTeacherBeatAt: beat,
    manualPause: manual,
    ...marks,
    autoEnd,
    remainingSec: Math.max(0, TEACHING_LIMIT_SEC - (autoEnd ? TEACHING_LIMIT_SEC : projected)),
    projectedTeachingSeconds: autoEnd ? TEACHING_LIMIT_SEC : projected,
  };
}

export function setManualPause(input: TeachingClockInput, paused: boolean): TeachingClockResult {
  if (paused) {
    const flushed = advanceTeachingClock({ ...input, actor: "teacher" });
    if (flushed.autoEnd || flushed.status === "ended") return flushed;
    return { ...flushed, status: "paused", manualPause: true };
  }
  return advanceTeachingClock({
    ...input,
    status: "paused",
    manualPause: false,
    actor: "teacher",
    lastTeacherBeatAt: input.now,
  });
}
