/**
 * Course lifecycle review policy (pure — no DB). FF_COURSE_REVIEW_V1.
 *
 * draft ─submit→ submitted ─start_review→ in_review
 * submitted|in_review ─request_changes→ changes_requested ─submit→ submitted
 * submitted|in_review ─reject→ rejected (terminal)
 * submitted|in_review ─approve(price)→ approved ─publish→ upcoming | published
 * upcoming|published ─first lesson starts→ active ─teacher finishes→ completed
 */

import type { CourseLifecycleStatus } from "@/generated/prisma/client";

export type CourseReviewAction =
  | "submit"
  | "start_review"
  | "request_changes"
  | "reject"
  | "approve"
  | "publish";

export type CourseReviewActor = "owner_teacher" | "admin";

const TRANSITIONS: Record<
  CourseReviewAction,
  { from: readonly CourseLifecycleStatus[]; actor: CourseReviewActor }
> = {
  submit: { from: ["draft", "changes_requested"], actor: "owner_teacher" },
  start_review: { from: ["submitted"], actor: "admin" },
  request_changes: { from: ["submitted", "in_review"], actor: "admin" },
  reject: { from: ["submitted", "in_review"], actor: "admin" },
  approve: { from: ["submitted", "in_review"], actor: "admin" },
  publish: { from: ["approved"], actor: "admin" },
};

export const COURSE_MIN_DESCRIPTION = 20;
export const COURSE_MIN_REASON = 5;
export const COURSE_MIN_PRICE = 1_000;
export const COURSE_MAX_PRICE = 100_000_000;
export const COURSE_MAX_CAPACITY = 10_000;

export type ReviewCheck =
  | { ok: true; to: CourseLifecycleStatus }
  | { ok: false; code: "FORBIDDEN" | "INVALID_TRANSITION" | "VALIDATION"; message: string };

export type ReviewCheckInput = {
  action: CourseReviewAction;
  actor: CourseReviewActor | null;
  current: CourseLifecycleStatus | null;
  reason?: string | null;
  listPrice?: number | null;
  /** approve only: null/undefined = unlimited seats. */
  capacity?: number | null;
  course: { titleUz: string; descriptionUz: string; lessonCount: number };
  /** publish only: first scheduled lesson is still ahead. */
  hasFutureLesson?: boolean;
};

export function checkCourseReviewAction(input: ReviewCheckInput): ReviewCheck {
  const rule = TRANSITIONS[input.action];
  if (!input.actor || input.actor !== rule.actor) {
    return { ok: false, code: "FORBIDDEN", message: "Bu amal uchun ruxsat yo‘q" };
  }
  if (input.current == null || !rule.from.includes(input.current)) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: `Kurs «${lifecycleLabel(input.current)}» holatida — bu amalni bajarib bo‘lmaydi`,
    };
  }

  switch (input.action) {
    case "submit": {
      if (input.course.titleUz.trim().length < 2) {
        return { ok: false, code: "VALIDATION", message: "Kurs nomini kiriting" };
      }
      if (input.course.descriptionUz.trim().length < COURSE_MIN_DESCRIPTION) {
        return {
          ok: false,
          code: "VALIDATION",
          message: `Tavsif kamida ${COURSE_MIN_DESCRIPTION} belgi bo‘lsin`,
        };
      }
      if (input.course.lessonCount < 1) {
        return { ok: false, code: "VALIDATION", message: "Kamida bitta dars rejalashtiring" };
      }
      return { ok: true, to: "submitted" };
    }
    case "start_review":
      return { ok: true, to: "in_review" };
    case "request_changes":
    case "reject": {
      if ((input.reason ?? "").trim().length < COURSE_MIN_REASON) {
        return { ok: false, code: "VALIDATION", message: "Sababni yozing (kamida 5 belgi)" };
      }
      return { ok: true, to: input.action === "reject" ? "rejected" : "changes_requested" };
    }
    case "approve": {
      const price = input.listPrice;
      if (
        price == null ||
        !Number.isInteger(price) ||
        price < COURSE_MIN_PRICE ||
        price > COURSE_MAX_PRICE
      ) {
        return {
          ok: false,
          code: "VALIDATION",
          message: `Narx ${COURSE_MIN_PRICE.toLocaleString("ru-RU")} so‘mdan kam bo‘lmasin`,
        };
      }
      const capacity = input.capacity;
      if (
        capacity != null &&
        (!Number.isInteger(capacity) || capacity < 1 || capacity > COURSE_MAX_CAPACITY)
      ) {
        return {
          ok: false,
          code: "VALIDATION",
          message: `Joylar soni 1 dan ${COURSE_MAX_CAPACITY} gacha bo‘lsin (bo‘sh — cheklanmagan)`,
        };
      }
      return { ok: true, to: "approved" };
    }
    case "publish":
      return { ok: true, to: input.hasFutureLesson ? "upcoming" : "published" };
  }
}

/** Teacher may edit course text only while it is theirs to change. */
export function isTeacherEditableLifecycle(status: CourseLifecycleStatus | null): boolean {
  return status === "draft" || status === "changes_requested";
}

/** Live lessons require a course students can actually own. Legacy (null) keeps old behaviour. */
export function isLiveAllowedForCourse(status: CourseLifecycleStatus | null): boolean {
  if (status == null) return true;
  return status === "published" || status === "upcoming" || status === "active";
}

const LABELS: Record<CourseLifecycleStatus, string> = {
  draft: "Qoralama",
  submitted: "Tekshiruvga yuborilgan",
  in_review: "Tekshirilmoqda",
  changes_requested: "O‘zgartirish so‘ralgan",
  rejected: "Rad etilgan",
  approved: "Tasdiqlangan",
  published: "Nashr etilgan",
  upcoming: "Tez orada",
  active: "Faol",
  completed: "Yakunlangan",
  archived: "Arxivlangan",
  cancelled: "Bekor qilingan",
  unpublished: "Nashrdan olingan",
};

export function lifecycleLabel(status: CourseLifecycleStatus | null): string {
  return status == null ? "Nashrda (eski tartib)" : LABELS[status];
}
