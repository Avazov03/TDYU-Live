import { randomBytes } from "crypto";

export function createInviteToken() {
  return randomBytes(24).toString("hex");
}

export function inviteExpiresAt(days = 14) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

export function inviteUrl(token: string) {
  const base = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/invite/${token}`;
}
