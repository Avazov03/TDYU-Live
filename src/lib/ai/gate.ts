import { auth } from "@/lib/auth";
import { getAiMentorAudience, isAiMentorEnabled } from "@/lib/feature-flags";
import { geminiConfigured } from "@/lib/ai/gemini";
import { isFakeGemini } from "@/lib/ai/mentor";
import { aiAudienceAllows, toAiRole, type AiRole } from "@/lib/ai/policy";

export type AiViewer = { userId: string | null; role: AiRole; firstName: string | null };

/** Null when the assistant is off, unconfigured, or not yet rolled out to this viewer's role. */
export async function resolveAiViewer(): Promise<AiViewer | null> {
  if (!isAiMentorEnabled()) return null;
  if (!geminiConfigured() && !isFakeGemini()) return null;
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const role = userId ? toAiRole(session?.user?.role) : "guest";
  if (!aiAudienceAllows(getAiMentorAudience(), role)) return null;
  const firstName = session?.user?.name?.trim().split(/\s+/)[0] ?? null;
  return { userId, role, firstName };
}
