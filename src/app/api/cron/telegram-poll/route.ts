import { NextResponse } from "next/server";
import { pollTelegramOnce } from "@/lib/telegram/poll";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Zaxira: CRON_SECRET bilan qisqa poll (asosiy — PM2 long-poll). */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const url = new URL(req.url);
    const q = url.searchParams.get("secret") ?? "";
    if (bearer !== secret && q !== secret) {
      return NextResponse.json({ error: "Ruxsat yo‘q" }, { status: 401 });
    }
  }

  const result = await pollTelegramOnce();
  return NextResponse.json(result);
}
