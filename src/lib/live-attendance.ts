/**
 * Phase 7 Live Wave 3 — AttendanceInterval lifecycle (LIVE participation only).
 *
 * Waiting Room ≠ attendance. Server owns timestamps.
 */

import { prisma } from "@/lib/prisma";
import { isLiveAttendanceV3Enabled } from "@/lib/feature-flags";

export const ATTENDANCE_SOURCE_LIVE = "live";

/** Stale open-interval cleanup when peer vanishes without an explicit leave (peer TTL ~20s). */
export const ATTENDANCE_STALE_MS = 45_000;

export function userIdFromLivePeerId(peerId: string): string | null {
  if (!peerId.startsWith("u_")) return null;
  const hex = peerId.slice(2).toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function attendanceDurationMs(input: {
  joinedAt: Date;
  leftAt: Date | null;
  now?: Date;
}): number {
  const end = input.leftAt ?? input.now ?? new Date();
  const ms = end.getTime() - input.joinedAt.getTime();
  return ms < 0 ? 0 : ms;
}

export function attendanceDurationSeconds(input: {
  joinedAt: Date;
  leftAt: Date | null;
  now?: Date;
}): number {
  return Math.floor(attendanceDurationMs(input) / 1000);
}

/** Pure gate: should this join create/reuse a LIVE attendance interval? */
export function shouldOpenLiveAttendance(input: {
  flagOn: boolean;
  moderator: boolean;
  phase: "lobby" | "live";
  liveSessionStatus: string;
  liveSessionId: string;
}): { ok: true } | { ok: false; code: string } {
  if (!input.flagOn) return { ok: false, code: "FLAG_OFF" };
  if (input.moderator) return { ok: false, code: "TEACHER_NOT_STUDENT_ATTENDANCE" };
  if (input.phase !== "live") return { ok: false, code: "WAITING_NOT_ATTENDANCE" };
  if (input.liveSessionStatus !== "live") return { ok: false, code: "SESSION_NOT_LIVE" };
  if (!input.liveSessionId || input.liveSessionId.startsWith("legacy:")) {
    return { ok: false, code: "NO_LIVE_SESSION" };
  }
  return { ok: true };
}

export async function findOpenAttendanceInterval(input: {
  userId: string;
  liveSessionId: string;
}) {
  return prisma.attendanceInterval.findFirst({
    where: {
      userId: input.userId,
      liveSessionId: input.liveSessionId,
      leftAt: null,
    },
    orderBy: { joinedAt: "desc" },
  });
}

/**
 * Open (or reuse) a LIVE attendance interval. Idempotent for refresh races.
 * Never opens for waiting room / teachers.
 */
export async function openLiveAttendanceInterval(input: {
  userId: string;
  lessonId: string;
  liveSessionId: string;
  moderator: boolean;
  phase: "lobby" | "live";
  liveSessionStatus: string;
}): Promise<
  | { ok: true; interval: { id: string; joinedAt: Date; leftAt: Date | null }; reused: boolean }
  | { ok: false; code: string }
> {
  if (!isLiveAttendanceV3Enabled()) {
    return { ok: false, code: "FLAG_OFF" };
  }
  const gate = shouldOpenLiveAttendance({
    flagOn: true,
    moderator: input.moderator,
    phase: input.phase,
    liveSessionStatus: input.liveSessionStatus,
    liveSessionId: input.liveSessionId,
  });
  if (!gate.ok) return gate;

  const existing = await findOpenAttendanceInterval({
    userId: input.userId,
    liveSessionId: input.liveSessionId,
  });
  if (existing) {
    return {
      ok: true,
      interval: { id: existing.id, joinedAt: existing.joinedAt, leftAt: existing.leftAt },
      reused: true,
    };
  }

  try {
    const created = await prisma.attendanceInterval.create({
      data: {
        userId: input.userId,
        lessonId: input.lessonId,
        liveSessionId: input.liveSessionId,
        joinedAt: new Date(), // server time only
        leftAt: null,
        source: ATTENDANCE_SOURCE_LIVE,
      },
    });
    return {
      ok: true,
      interval: { id: created.id, joinedAt: created.joinedAt, leftAt: created.leftAt },
      reused: false,
    };
  } catch {
    // Unique partial index race: another request opened first — reuse.
    const raced = await findOpenAttendanceInterval({
      userId: input.userId,
      liveSessionId: input.liveSessionId,
    });
    if (raced) {
      return {
        ok: true,
        interval: { id: raced.id, joinedAt: raced.joinedAt, leftAt: raced.leftAt },
        reused: true,
      };
    }
    return { ok: false, code: "CREATE_FAILED" };
  }
}

/** Close the caller's open interval for a live session (leave / disconnect). */
export async function closeLiveAttendanceInterval(input: {
  userId: string;
  liveSessionId: string;
}): Promise<{ ok: true; closed: boolean; intervalId?: string }> {
  if (!isLiveAttendanceV3Enabled()) {
    return { ok: true, closed: false };
  }
  const open = await findOpenAttendanceInterval({
    userId: input.userId,
    liveSessionId: input.liveSessionId,
  });
  if (!open) return { ok: true, closed: false };

  const now = new Date();
  // Guard: leftAt must not precede joinedAt
  const leftAt = now < open.joinedAt ? open.joinedAt : now;
  await prisma.attendanceInterval.update({
    where: { id: open.id },
    data: { leftAt },
  });
  return { ok: true, closed: true, intervalId: open.id };
}

/** Teacher ends LIVE — close every open student interval for that session. */
export async function closeAllOpenAttendanceForLiveSession(
  liveSessionId: string,
): Promise<{ ok: true; closedCount: number }> {
  if (!isLiveAttendanceV3Enabled()) {
    return { ok: true, closedCount: 0 };
  }
  if (!liveSessionId || liveSessionId.startsWith("legacy:")) {
    return { ok: true, closedCount: 0 };
  }
  const now = new Date();
  const result = await prisma.attendanceInterval.updateMany({
    where: { liveSessionId, leftAt: null },
    data: { leftAt: now },
  });
  return { ok: true, closedCount: result.count };
}

/**
 * Close open intervals for peers that disappeared from the in-memory room
 * (hard disconnect / tab kill without leave). Conservative stale window.
 */
export async function closeStaleAttendanceForMissingPeers(input: {
  liveSessionId: string;
  presentUserIds: Set<string>;
  staleBefore: Date;
}): Promise<number> {
  if (!isLiveAttendanceV3Enabled()) return 0;
  if (!input.liveSessionId || input.liveSessionId.startsWith("legacy:")) return 0;

  const open = await prisma.attendanceInterval.findMany({
    where: {
      liveSessionId: input.liveSessionId,
      leftAt: null,
      joinedAt: { lt: input.staleBefore },
      source: ATTENDANCE_SOURCE_LIVE,
    },
    select: { id: true, userId: true, joinedAt: true },
  });

  let closed = 0;
  const now = new Date();
  for (const row of open) {
    if (input.presentUserIds.has(row.userId)) continue;
    const leftAt = now < row.joinedAt ? row.joinedAt : now;
    await prisma.attendanceInterval.update({
      where: { id: row.id },
      data: { leftAt },
    });
    closed += 1;
  }
  return closed;
}

export async function listAttendanceIntervalsForLiveSession(liveSessionId: string) {
  return prisma.attendanceInterval.findMany({
    where: { liveSessionId },
    orderBy: [{ userId: "asc" }, { joinedAt: "asc" }],
  });
}

export async function sumAttendanceSecondsForUserSession(
  userId: string,
  liveSessionId: string,
  now = new Date(),
): Promise<number> {
  const rows = await prisma.attendanceInterval.findMany({
    where: { userId, liveSessionId },
  });
  return rows.reduce(
    (sum, row) => sum + attendanceDurationSeconds({ joinedAt: row.joinedAt, leftAt: row.leftAt, now }),
    0,
  );
}
