/**
 * Server-side live join authorization (Phase 7 Wave 1).
 * Reuses Wave 1 getLessonAccess — no parallel auth system.
 */

import { prisma } from "@/lib/prisma";
import { getLessonAccess } from "@/lib/access";
import { isLiveWaitingRoomV2Enabled } from "@/lib/feature-flags";
import { isAdminRole, isTeacherRole } from "@/lib/roles";
import {
  findActiveLiveSession,
  isJoinableLiveLessonStatus,
} from "@/lib/live-session";
import { issueLiveJoinToken, livePeerIdForUser } from "@/lib/live-join-token";

export type LiveJoinAuthOk = {
  ok: true;
  moderator: boolean;
  lessonId: string;
  courseId: string;
  lessonStatus: string;
  liveSessionId: string;
  liveSessionStatus: string;
  peerId: string;
  joinToken: string;
  phase: "lobby" | "live";
};

export type LiveJoinAuthDeny = {
  ok: false;
  code: string;
  message: string;
  http: number;
};

export type LiveJoinAuthResult = LiveJoinAuthOk | LiveJoinAuthDeny;

export async function authorizeLiveJoin(input: {
  userId: string;
  role: string;
  lessonId: string;
}): Promise<LiveJoinAuthResult> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: input.lessonId },
    include: { course: { include: { teacher: true } } },
  });
  if (!lesson) {
    return { ok: false, code: "LESSON_NOT_FOUND", message: "Dars topilmadi", http: 404 };
  }
  if (lesson.status === "cancelled") {
    return { ok: false, code: "LESSON_CANCELLED", message: "Dars bekor qilingan", http: 403 };
  }

  const v2 = isLiveWaitingRoomV2Enabled();
  const joinable = v2
    ? isJoinableLiveLessonStatus(lesson.status)
    : lesson.status === "live";

  if (!joinable) {
    return {
      ok: false,
      code: "NOT_JOINABLE",
      message: "Dars xonasiga hozir kirib bo‘lmaydi",
      http: 403,
    };
  }

  const moderator =
    isAdminRole(input.role) ||
    (isTeacherRole(input.role) && lesson.course.teacher.userId === input.userId);

  if (!moderator) {
    const access = await getLessonAccess(input.userId, lesson.courseId, lesson.status);
    if (!access.ok) {
      return {
        ok: false,
        code: "NO_ENROLLMENT",
        message: "Ruxsat yo'q",
        http: 403,
      };
    }
  }

  let session = await findActiveLiveSession(lesson.id);
  if (!session) {
    // Legacy path (flag off / live without LiveSession row): allow signal-only with synthetic id.
    if (!v2 && lesson.status === "live") {
      return {
        ok: true,
        moderator,
        lessonId: lesson.id,
        courseId: lesson.courseId,
        lessonStatus: lesson.status,
        liveSessionId: `legacy:${lesson.id}`,
        liveSessionStatus: "live",
        peerId: livePeerIdForUser(input.userId),
        joinToken: "",
        phase: "live",
      };
    }
    return {
      ok: false,
      code: "NO_LIVE_SESSION",
      message: "Kutish xonasi ochilmagan",
      http: 403,
    };
  }

  if (session.status === "ended" || session.status === "abandoned") {
    return {
      ok: false,
      code: "SESSION_ENDED",
      message: "Jonli dars yakunlangan",
      http: 403,
    };
  }

  const phase: "lobby" | "live" =
    session.status === "live" || lesson.status === "live" ? "live" : "lobby";

  const joinToken = v2
    ? issueLiveJoinToken({
        userId: input.userId,
        lessonId: lesson.id,
        liveSessionId: session.id,
      })
    : "";

  return {
    ok: true,
    moderator,
    lessonId: lesson.id,
    courseId: lesson.courseId,
    lessonStatus: lesson.status,
    liveSessionId: session.id,
    liveSessionStatus: session.status,
    peerId: livePeerIdForUser(input.userId),
    joinToken,
    phase,
  };
}
