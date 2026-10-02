import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { tashkentDayKey } from "@/lib/notify-policy";
import { getClientIp } from "@/lib/rate-limit";
import { AI_DAILY_LIMITS, AI_DEFAULT_DAILY_TOKEN_BUDGET, AI_PER_MINUTE, type AiRole } from "@/lib/ai/policy";

const recent = new Map<string, number[]>();

export function aiSubjectKey(userId: string | null, req: Request): string {
  if (userId) return `user:${userId}`;
  const ip = getClientIp(req);
  const salt = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "lexify";
  return `anon:${createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 24)}`;
}

/** In-process burst guard (single PM2 instance); daily limits live in the DB. */
export function allowBurst(subjectKey: string, now = Date.now()): boolean {
  const list = (recent.get(subjectKey) ?? []).filter((t) => now - t < 60_000);
  if (list.length >= AI_PER_MINUTE) {
    recent.set(subjectKey, list);
    return false;
  }
  list.push(now);
  recent.set(subjectKey, list);
  if (recent.size > 5000) recent.clear();
  return true;
}

export function dailyTokenBudget(): number {
  const n = Number(process.env.AI_DAILY_TOKEN_BUDGET);
  return Number.isFinite(n) && n > 0 ? n : AI_DEFAULT_DAILY_TOKEN_BUDGET;
}

/** `AI_DAILY_LIMIT_<ROLE>` overrides the default per-role daily request cap. */
export function dailyLimit(role: AiRole): number {
  const n = Number(process.env[`AI_DAILY_LIMIT_${role.toUpperCase()}`]);
  return Number.isInteger(n) && n > 0 ? n : AI_DAILY_LIMITS[role];
}

export type UsageVerdict = { ok: true; remaining: number } | { ok: false; code: "DAILY_LIMIT" | "BUDGET" };

/** Counts the request up-front (attempts count), then checks the role limit and the global token budget. */
export async function reserveAiRequest(subjectKey: string, role: AiRole): Promise<UsageVerdict> {
  const day = tashkentDayKey(new Date());
  const spent = await prisma.aiUsage.aggregate({ where: { day }, _sum: { tokens: true } });
  if ((spent._sum.tokens ?? 0) >= dailyTokenBudget()) return { ok: false, code: "BUDGET" };
  const row = await prisma.aiUsage.upsert({
    where: { subjectKey_day: { subjectKey, day } },
    create: { subjectKey, day, requests: 1 },
    update: { requests: { increment: 1 } },
  });
  const limit = dailyLimit(role);
  if (row.requests > limit) return { ok: false, code: "DAILY_LIMIT" };
  return { ok: true, remaining: limit - row.requests };
}

export async function recordAiTokens(subjectKey: string, tokens: number) {
  if (tokens <= 0) return;
  const day = tashkentDayKey(new Date());
  await prisma.aiUsage.update({
    where: { subjectKey_day: { subjectKey, day } },
    data: { tokens: { increment: tokens } },
  });
}
