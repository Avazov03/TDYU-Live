import { coverUrl as generatedCover } from "@/lib/thumbs";

const TZ = "Asia/Tashkent";

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
  return new Intl.DateTimeFormat("uz-UZ", { timeZone: TZ, day: "numeric", month: "long" }).format(date);
}

export function clockLabel(date: Date) {
  return new Intl.DateTimeFormat("uz-UZ", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(date);
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

export function statusLabel(status: "live" | "scheduled" | "ended") {
  if (status === "live") return "Jonli";
  if (status === "ended") return "Yozuv";
  return "Reja";
}
