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

export function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("uz-UZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
