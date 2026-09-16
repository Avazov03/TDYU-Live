import { createHash, randomBytes } from "crypto";
import { authError, authLog } from "@/lib/auth-log";

export function createPasswordResetToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashPasswordResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Lexify <noreply@localhost>";
  if (!key) {
    authLog("email_skipped_no_resend_key", { to, subject });
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      authError("email_send_failed", body || res.statusText, { to, subject, status: res.status });
      return false;
    }
    authLog("email_sent", { to, subject });
    return true;
  } catch (error) {
    authError("email_send_failed", error, { to, subject });
    return false;
  }
}

export function appBaseUrl(): string {
  return (
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}
