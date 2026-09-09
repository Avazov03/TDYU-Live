import { createHmac, randomBytes, timingSafeEqual } from "crypto";

type Ticket =
  | { kind: "as"; adminId: string; userId: string; exp: number }
  | { kind: "back"; adminId: string; exp: number };

function secret() {
  return process.env.AUTH_SECRET || "dev-only-change-me";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createImpersonateTicket(adminId: string, userId: string) {
  const ticket: Ticket = { kind: "as", adminId, userId, exp: Date.now() + 120_000 };
  const payload = Buffer.from(JSON.stringify(ticket)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function createRestoreTicket(adminId: string) {
  const ticket: Ticket = { kind: "back", adminId, exp: Date.now() + 120_000 };
  const payload = Buffer.from(JSON.stringify(ticket)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readTicket(raw: string | undefined): Ticket | null {
  if (!raw || !raw.includes(".")) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const ticket = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Ticket;
    if (!ticket?.exp || ticket.exp < Date.now()) return null;
    if (ticket.kind !== "as" && ticket.kind !== "back") return null;
    return ticket;
  } catch {
    return null;
  }
}

export function randomTeacherPassword() {
  return randomBytes(18).toString("base64url");
}

/** Faqat Avazov admin login aliase. Boshqa loginlar email bo'lishi kerak. */
export function resolveLoginId(raw: string) {
  const value = raw.trim().toLowerCase();
  if (!value) return "";
  if (value.includes("@")) return value;
  if (value === "avazov") return "avazov@tdyu.live";
  return "";
}
