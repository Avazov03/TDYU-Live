/**
 * Phase 7 Live Wave 1 — LiveSession lifecycle (DB authoritative).
 *
 * Lesson.status remains UI-compatible (lobby | live | ended).
 * LiveSession maps: waiting ↔ lobby/waiting_room, live ↔ live, ended ↔ ended.
 *
 * Duplicate active sessions prevented by partial unique index + transactional find.
 */

import type { LiveSession, LiveSessionStatus, PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type LiveDb = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

const ACTIVE: LiveSessionStatus[] = ["created", "waiting", "live", "paused"];

export function isWaitingLessonStatus(status: string): boolean {
  return status === "lobby" || status === "waiting_room";
}

export function isJoinableLiveLessonStatus(status: string): boolean {
  return status === "live" || isWaitingLessonStatus(status);
}

export async function findActiveLiveSession(
  lessonId: string,
  db: LiveDb = prisma,
): Promise<LiveSession | null> {
  return db.liveSession.findFirst({
    where: { lessonId, status: { in: ACTIVE } },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Open or reuse Waiting LiveSession for a lesson.
 * Does not change Lesson.status — caller updates Lesson (lobby).
 */
export async function ensureWaitingLiveSession(lessonId: string): Promise<LiveSession> {
  return prisma.$transaction(async (tx) => {
    const existing = await findActiveLiveSession(lessonId, tx);
    if (existing) {
      if (existing.status === "live" || existing.status === "paused") return existing;
      if (existing.status === "waiting" || existing.status === "created") {
        if (existing.status === "created") {
          return tx.liveSession.update({
            where: { id: existing.id },
            data: { status: "waiting" },
          });
        }
        return existing;
      }
    }
    return tx.liveSession.create({
      data: {
        lessonId,
        status: "waiting",
        roomKey: `lesson:${lessonId}`,
      },
    });
  });
}

/** WAITING → LIVE (idempotent if already live). */
export async function startLiveSession(lessonId: string): Promise<LiveSession> {
  return prisma.$transaction(async (tx) => {
    const existing = await findActiveLiveSession(lessonId, tx);
    if (existing?.status === "live") return existing;
    if (existing && (existing.status === "waiting" || existing.status === "created" || existing.status === "paused")) {
      return tx.liveSession.update({
        where: { id: existing.id },
        data: {
          status: "live",
          sessionStartedAt: existing.sessionStartedAt ?? new Date(),
        },
      });
    }
    return tx.liveSession.create({
      data: {
        lessonId,
        status: "live",
        sessionStartedAt: new Date(),
        roomKey: `lesson:${lessonId}`,
      },
    });
  });
}

/** Any active session → ENDED. */
export async function endLiveSession(lessonId: string): Promise<LiveSession | null> {
  return prisma.$transaction(async (tx) => {
    const existing = await findActiveLiveSession(lessonId, tx);
    if (!existing) return null;
    return tx.liveSession.update({
      where: { id: existing.id },
      data: { status: "ended", endedAt: new Date() },
    });
  });
}

/** Pure helpers for tests — map statuses without DB. */
export function mapLessonToSessionIntent(
  lessonStatus: string,
): "waiting" | "live" | "ended" | "deny" {
  if (lessonStatus === "cancelled") return "deny";
  if (lessonStatus === "ended" || lessonStatus === "published" || lessonStatus === "teacher_review") {
    return "ended";
  }
  if (lessonStatus === "live" || lessonStatus === "paused") return "live";
  if (isWaitingLessonStatus(lessonStatus) || lessonStatus === "scheduled") return "waiting";
  return "deny";
}

export function canTeacherOpenWaiting(lessonStatus: string): boolean {
  return lessonStatus === "scheduled" || isWaitingLessonStatus(lessonStatus) || lessonStatus === "live";
}

export function canTeacherStartLive(lessonStatus: string): boolean {
  return (
    lessonStatus === "scheduled" ||
    isWaitingLessonStatus(lessonStatus) ||
    lessonStatus === "live"
  );
}

export function canTeacherEndLive(lessonStatus: string): boolean {
  return lessonStatus === "live" || isWaitingLessonStatus(lessonStatus);
}
