import { NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { pollTelegramOnce } from "@/lib/telegram/poll";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Zaxira: CRON_SECRET bilan qisqa poll (asosiy — PM2 long-poll). */
export async function GET(req: Request) {
  const denied = cronAuthError(req);
  if (denied) return denied;

  const result = await pollTelegramOnce();
  return NextResponse.json(result);
}
