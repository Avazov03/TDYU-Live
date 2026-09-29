/**
 * Certificates — spec §14: Teacher issues based on activity data and uploads the file manually.
 * No auto generation, no Admin approval. Issue only after the course is finished; revocation needs a reason.
 */

import type { CourseLifecycleStatus, LessonStatus } from "@/generated/prisma/client";

export const CERTIFICATE_MAX_BYTES = 10 * 1024 * 1024;
export const CERTIFICATE_MIN_REASON = 5;
export const CERTIFICATE_LOW_ATTENDANCE_PCT = 50;

const LESSON_DONE: readonly LessonStatus[] = [
  "ended",
  "recording_processing",
  "recording_ready",
  "teacher_review",
  "published",
  "cancelled",
];

/**
 * Review-flow courses are finished only via course completion (`completed`).
 * Legacy courses (no lifecycle) have no completion step: finished when every planned lesson is over.
 */
export function isCourseFinishedForCertificate(input: {
  lifecycleStatus: CourseLifecycleStatus | null;
  lessonStatuses: LessonStatus[];
}): boolean {
  if (input.lifecycleStatus === "completed") return true;
  if (input.lifecycleStatus !== null) return false;
  const held = input.lessonStatuses.filter((s) => s !== "cancelled");
  return held.length > 0 && input.lessonStatuses.every((s) => LESSON_DONE.includes(s));
}

export type CertificateFileKind = { ext: "pdf" | "png" | "jpg"; mime: string };

/** Type is decided by file content (magic bytes), not by the client-supplied name or MIME. */
export function detectCertificateFile(head: Uint8Array): CertificateFileKind | null {
  const b = head;
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) {
    return { ext: "pdf", mime: "application/pdf" };
  }
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return { ext: "png", mime: "image/png" };
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" };
  }
  return null;
}

export type CertificateFileCheck =
  | { ok: true; kind: CertificateFileKind }
  | { ok: false; code: "FILE_REQUIRED" | "FILE_TOO_LARGE" | "FILE_TYPE"; message: string };

export function checkCertificateFile(input: { size: number; head: Uint8Array }): CertificateFileCheck {
  if (input.size <= 0) return { ok: false, code: "FILE_REQUIRED", message: "Sertifikat faylini yuklang" };
  if (input.size > CERTIFICATE_MAX_BYTES) {
    return { ok: false, code: "FILE_TOO_LARGE", message: "Fayl 10 MB dan oshmasin" };
  }
  const kind = detectCertificateFile(input.head);
  if (!kind) return { ok: false, code: "FILE_TYPE", message: "Faqat PDF, JPG yoki PNG fayl" };
  return { ok: true, kind };
}

export function isLowAttendance(attended: number, lessonCount: number): boolean {
  if (lessonCount <= 0) return false;
  return (attended / lessonCount) * 100 < CERTIFICATE_LOW_ATTENDANCE_PCT;
}

export function checkRevokeReason(reason: string | null | undefined): { ok: true; reason: string } | { ok: false; message: string } {
  const r = reason?.trim() ?? "";
  if (r.length < CERTIFICATE_MIN_REASON) {
    return { ok: false, message: `Bekor qilish sababini yozing (kamida ${CERTIFICATE_MIN_REASON} belgi)` };
  }
  return { ok: true, reason: r.slice(0, 1000) };
}

/** Student sees only active certificates; the course teacher and admins also see revoked ones. */
export function canViewCertificate(input: {
  viewerId: string;
  ownerId: string;
  isAdmin: boolean;
  isCourseTeacher: boolean;
  revoked: boolean;
}): boolean {
  if (input.isAdmin || input.isCourseTeacher) return true;
  return input.viewerId === input.ownerId && !input.revoked;
}

export function buildCertificateFileKey(input: { courseId: string; certificateId: string; ext: string; now?: number }) {
  return `certificates/${input.courseId}/${input.certificateId}-${input.now ?? Date.now()}.${input.ext}`;
}

const KEY_RE = /^certificates\/[0-9a-f-]{36}\/[0-9a-f-]{36}-\d{13}\.(pdf|png|jpg)$/i;

export function isValidCertificateFileKey(key: string | null | undefined): key is string {
  return Boolean(key && KEY_RE.test(key));
}
