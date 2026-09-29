import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")} mln`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".0", "")} ming`;
  return String(n);
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatRelativeDate(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "Bugun";
  if (days === 1) return "Kecha";
  if (days < 7) return `${days} kun oldin`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} hafta oldin`;
  const months = Math.floor(days / 30);
  return `${months} oy oldin`;
}

export function localizedField<T extends Record<string, unknown>>(
  obj: T,
  field: string,
  lang: "uz" | "ru" | "en" = "uz",
): string {
  const key = `${field}${lang.charAt(0).toUpperCase()}${lang.slice(1)}`;
  const value = obj[key as keyof T];
  if (typeof value === "string" && value) return value;
  const fallback = obj[`${field}Uz` as keyof T];
  return typeof fallback === "string" ? fallback : "";
}

const NAIVE_LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/;

/**
 * Parse a schedule time from the client. `datetime-local` values carry no zone; the product
 * runs on Asia/Tashkent (UTC+5, no DST), so a naive value is Tashkent wall-clock time.
 */
export function parseClientDateTime(value: string): Date {
  const trimmed = value.trim();
  return new Date(NAIVE_LOCAL_DATETIME.test(trimmed) ? `${trimmed}+05:00` : trimmed);
}

/** `datetime-local` input value (Tashkent wall-clock, whatever the browser zone) → ISO instant. */
export function localInputToIso(value: string): string {
  const d = parseClientDateTime(value);
  return Number.isNaN(d.getTime()) ? value : d.toISOString();
}

// Browsers often ship ICU without `uz` month names ("M09"); spell them out so SSR and CSR agree.
export const UZ_MONTHS_LONG = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
] as const;
export const UZ_MONTHS_SHORT = [
  "yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek",
] as const;

const TASHKENT_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Tashkent",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function tashkentParts(date: Date) {
  const p = Object.fromEntries(TASHKENT_PARTS.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    year: p.year,
    monthIndex: Number(p.month) - 1,
    day: p.day,
    hour: p.hour,
    minute: p.minute,
  };
}

/** `YYYY-MM-DDTHH:00` for the next full hour in Asia/Tashkent — identical on server and client. */
export function nextTashkentHourInput(now = new Date()): string {
  const p = tashkentParts(new Date(now.getTime() + 60 * 60 * 1000));
  return `${p.year}-${String(p.monthIndex + 1).padStart(2, "0")}-${p.day}T${p.hour}:00`;
}

/** "05-okt, 2026, 18:00" in Asia/Tashkent. */
export function formatDateTime(date: Date) {
  const p = tashkentParts(date);
  return `${p.day}-${UZ_MONTHS_SHORT[p.monthIndex]}, ${p.year}, ${p.hour}:${p.minute}`;
}
