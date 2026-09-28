/**
 * Staging/local E2E fixture reset — makes stateful browser suites rerunnable.
 *
 * Scope is hard-limited to the fixture teacher (scripts/phase2-access-fixture.ts)
 * and the dedicated E2E lesson ids in e2e/helpers/test-data.ts. These ids do not
 * exist in production; the route is additionally disabled unless
 * E2E_FIXTURE_RESET_TOKEN is set and the process is not production-like.
 */

import { timingSafeEqual } from "crypto";
import { rm } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { RECORDING_MIGRATE_AUDIT_ACTION } from "@/lib/recording-legacy-migration";
import { resolveRecordingStorageRoot } from "@/lib/recording-storage";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const E2E_FIXTURE_TEACHER_ID = "a3333333-3333-3333-3333-333333333301";

/** Lessons owned by browser E2E: live, recording and legacy-migration specs. */
export const E2E_OWNED_LESSON_IDS = [
  "d2500001-0000-4000-8000-000000000045",
  "d2500001-0000-4000-8000-000000000046",
  "d2500001-0000-4000-8000-000000000047",
  "d2500001-0000-4000-8000-000000000048",
  "d2500001-0000-4000-8000-000000000049",
  "d2500001-0000-4000-8000-000000000050",
] as const;

const RUNNING_LESSON_STATUSES = ["lobby", "waiting_room", "live", "paused"] as const;
const OPEN_SESSION_STATUSES = ["created", "waiting", "live", "paused"] as const;
const MIN_TOKEN_LENGTH = 24;
/** Owned lessons start slightly in the past so early-start conflict rules never see them as upcoming. */
const OWNED_LESSON_START_OFFSET_MS = 5 * 60_000;
// Mux live stream id / stream key are kept on purpose: clearing them would make the
// next real-Mux run create a new stream and orphan the old one.

export type ResetGate = { allowed: true; token: string } | { allowed: false; reason: string };

export function e2eFixtureResetGate(input: {
  token: string | undefined;
  productionLike: boolean;
}): ResetGate {
  if (input.productionLike) return { allowed: false, reason: "production-like environment" };
  const token = input.token?.trim() ?? "";
  if (token.length < MIN_TOKEN_LENGTH) {
    return { allowed: false, reason: "E2E_FIXTURE_RESET_TOKEN not configured" };
  }
  return { allowed: true, token };
}

export function resetTokenMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Only owned ids are accepted; unknown ids are dropped, empty input means all owned lessons. */
export function resolveOwnedLessonIds(requested: unknown): string[] {
  const owned = new Set<string>(E2E_OWNED_LESSON_IDS);
  if (!Array.isArray(requested) || requested.length === 0) return [...owned];
  return requested.filter((id): id is string => typeof id === "string" && owned.has(id));
}

export type FixtureResetReport = {
  ownedLessons: string[];
  closedIntervals: number;
  endedSessions: number;
  endedStrayLessons: string[];
  deletedRecordings: number;
  deletedMigrationAudits: number;
  resetLessons: number;
  deletedRecordingDirs: number;
  /** Scheduled fixture-teacher lessons starting within the next 90 minutes (would block early start). */
  upcomingBlockers: string[];
};

export async function runE2EFixtureReset(input: {
  lessonIds: string[];
  now?: Date;
}): Promise<FixtureResetReport> {
  const now = input.now ?? new Date();
  const owned = input.lessonIds;
  const teacherLessons = { course: { teacherId: E2E_FIXTURE_TEACHER_ID } };

  const report: FixtureResetReport = await prisma.$transaction(async (tx) => {
    const closedIntervals = await tx.attendanceInterval.updateMany({
      where: { leftAt: null, lesson: teacherLessons },
      data: { leftAt: now },
    });
    const endedSessions = await tx.liveSession.updateMany({
      where: { status: { in: [...OPEN_SESSION_STATUSES] }, lesson: teacherLessons },
      data: { status: "ended", endedAt: now },
    });

    const stray = await tx.lesson.findMany({
      where: {
        ...teacherLessons,
        id: { notIn: owned },
        status: { in: [...RUNNING_LESSON_STATUSES] },
      },
      select: { id: true },
    });
    if (stray.length) {
      await tx.lesson.updateMany({
        where: { id: { in: stray.map((l) => l.id) } },
        data: { status: "ended" },
      });
    }

    const ownedRecordings = await tx.recording.findMany({
      where: { lessonId: { in: owned } },
      select: { id: true },
    });
    const recordingIds = ownedRecordings.map((r) => r.id);
    const deletedMigrationAudits = recordingIds.length
      ? await tx.auditLog.deleteMany({
          where: {
            action: RECORDING_MIGRATE_AUDIT_ACTION,
            entityType: "Recording",
            entityId: { in: recordingIds },
          },
        })
      : { count: 0 };
    const deletedRecordings = await tx.recording.deleteMany({ where: { lessonId: { in: owned } } });
    await tx.attendanceInterval.deleteMany({ where: { lessonId: { in: owned } } });
    await tx.liveSession.deleteMany({ where: { lessonId: { in: owned } } });

    const resetLessons = await tx.lesson.updateMany({
      where: { id: { in: owned }, course: { teacherId: E2E_FIXTURE_TEACHER_ID } },
      data: {
        status: "scheduled",
        scheduledAt: new Date(now.getTime() - OWNED_LESSON_START_OFFSET_MS),
        scheduledEndAt: null,
        durationMinutes: null,
        cancelledAt: null,
        recordingUrl: null,
        muxVodPlaybackId: null,
      },
    });

    const upcoming = await tx.lesson.findMany({
      where: {
        ...teacherLessons,
        status: "scheduled",
        scheduledAt: { gt: now, lte: new Date(now.getTime() + 90 * 60_000) },
      },
      select: { id: true },
    });

    return {
      ownedLessons: owned,
      closedIntervals: closedIntervals.count,
      endedSessions: endedSessions.count,
      endedStrayLessons: stray.map((l) => l.id),
      deletedRecordings: deletedRecordings.count,
      deletedMigrationAudits: deletedMigrationAudits.count,
      resetLessons: resetLessons.count,
      deletedRecordingDirs: 0,
      upcomingBlockers: upcoming.map((l) => l.id),
    };
  });

  report.deletedRecordingDirs = await removeOwnedRecordingFiles(owned);
  return report;
}

async function removeOwnedRecordingFiles(owned: string[]): Promise<number> {
  const lessons = await prisma.lesson.findMany({
    where: { id: { in: owned }, course: { teacherId: E2E_FIXTURE_TEACHER_ID } },
    select: { id: true, courseId: true },
  });
  let root: string;
  try {
    root = resolveRecordingStorageRoot();
  } catch {
    return 0;
  }
  let removed = 0;
  for (const lesson of lessons) {
    if (!UUID_RE.test(lesson.id) || !UUID_RE.test(lesson.courseId)) continue;
    const dir = path.resolve(root, "recordings", lesson.courseId, lesson.id);
    if (!dir.startsWith(root + path.sep)) continue;
    const existed = await rm(dir, { recursive: true, force: false }).then(
      () => true,
      () => false,
    );
    if (existed) removed += 1;
  }
  return removed;
}
