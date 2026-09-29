import type { LessonStatus } from "@/generated/prisma/client";
import { coverUrl as generatedCover } from "@/lib/thumbs";
import { UZ_MONTHS_LONG, UZ_MONTHS_SHORT, tashkentParts } from "@/lib/utils";

const TZ = "Asia/Tashkent";

/** Includes legacy + Phase 1 target statuses (additive enum). */
export type PlanStatus = LessonStatus;

export function localDayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function dayTitle(date: Date) {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (localDayKey(date) === localDayKey(today)) return "Bugun";
  if (localDayKey(date) === localDayKey(tomorrow)) return "Ertaga";
  const p = tashkentParts(date);
  return `${Number(p.day)}-${UZ_MONTHS_LONG[p.monthIndex]}`;
}

/** "Bugun" / "Ertaga" / "13 okt" — compact day label for timelines. */
export function shortDayTitle(date: Date) {
  const key = localDayKey(date);
  const today = new Date();
  if (key === localDayKey(today)) return "Bugun";
  if (key === localDayKey(new Date(today.getTime() + 86_400_000))) return "Ertaga";
  if (key === localDayKey(new Date(today.getTime() - 86_400_000))) return "Kecha";
  const p = tashkentParts(date);
  return `${Number(p.day)} ${UZ_MONTHS_SHORT[p.monthIndex]}`;
}

/** "Bugun" / "Ertaga" / "5 kundan keyin" — calendar days in Asia/Tashkent. */
export function daysUntilLabel(date: Date, now = new Date()) {
  const days = Math.round(
    (Date.parse(localDayKey(date)) - Date.parse(localDayKey(now))) / 86_400_000,
  );
  if (days <= 0) return "Bugun";
  if (days === 1) return "Ertaga";
  return `${days} kundan keyin`;
}

const UZ_WEEKDAYS: Record<string, string> = {
  Monday: "Dushanba",
  Tuesday: "Seshanba",
  Wednesday: "Chorshanba",
  Thursday: "Payshanba",
  Friday: "Juma",
  Saturday: "Shanba",
  Sunday: "Yakshanba",
};
const WEEKDAY_FMT = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long" });

/** "Dushanba" in Asia/Tashkent. */
export function weekdayUz(date: Date) {
  return UZ_WEEKDAYS[WEEKDAY_FMT.format(date)] ?? "";
}

export function clockLabel(date: Date) {
  const p = tashkentParts(date);
  return `${p.hour}:${p.minute}`;
}

/** Banner yoki Mux thumbnail; demo playback uchun SVG placeholder. */
export function lessonCover(
  coverUrl: string | null | undefined,
  playbackId: string | null | undefined,
  meta?: { id: string; title: string },
) {
  if (coverUrl) return coverUrl;
  if (meta) return generatedCover(meta.id, meta.title, playbackId);
  if (playbackId && !playbackId.startsWith("demo_")) {
    return `https://image.mux.com/${playbackId}/thumbnail.jpg?width=640&height=360&fit_mode=smartcrop`;
  }
  return null;
}

/** Haqiqiy ko‘riladigan yozuv bormi (demo Mux emas). */
export function hasPlayableRecording(
  recordingUrl?: string | null,
  playbackId?: string | null,
) {
  if (recordingUrl) return true;
  if (playbackId && !playbackId.startsWith("demo_")) return true;
  return false;
}

export function statusLabel(
  status: PlanStatus,
  opts?: { hasRecording?: boolean },
) {
  if (status === "live") return "Jonli";
  if (status === "lobby" || status === "waiting_room") return "Kutish";
  if (status === "paused") return "Pauza";
  if (status === "scheduled") return "Reja";
  if (status === "cancelled") return "Bekor";
  if (status === "recording_processing") return "Yozuv tayyorlanmoqda";
  if (status === "recording_ready" || status === "teacher_review") return "Yozuv tekshiruvda";
  if (status === "published") return "Yozuv";
  if (status === "ended") {
    if (opts?.hasRecording === false) return "Yozuv kutilmoqda";
    if (opts?.hasRecording === true) return "Ko‘rish";
    return "Yozuv";
  }
  if (opts?.hasRecording === false) return "Yozuv kutilmoqda";
  if (opts?.hasRecording === true) return "Ko‘rish";
  return "Yozuv";
}

export function statusTone(
  status: PlanStatus,
  opts?: { hasRecording?: boolean },
) {
  if (status === "live") return "danger";
  if (status === "lobby" || status === "waiting_room" || status === "paused") return "accent";
  if (status === "scheduled") return "pending";
  if (status === "cancelled") return "pending";
  if (
    status === "recording_processing" ||
    status === "recording_ready" ||
    status === "teacher_review"
  ) {
    return "pending";
  }
  if (opts?.hasRecording === false) return "pending";
  return "success";
}

export function isJoinableLiveStatus(status: PlanStatus | string) {
  return status === "live" || status === "lobby" || status === "waiting_room";
}
