import { NextResponse } from "next/server";
import { resolveAiViewer } from "@/lib/ai/gate";

export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await resolveAiViewer();
  if (!viewer) return NextResponse.json({ enabled: false });
  return NextResponse.json({ enabled: true, role: viewer.role, firstName: viewer.firstName });
}
