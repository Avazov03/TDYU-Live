/**
 * E2E environment helpers.
 * Never default to production. Never embed production passwords.
 */

/** Exact production hostnames — E2E must refuse these. */
const PRODUCTION_HOSTS = new Set(["lexify.zonic.fit", "www.lexify.zonic.fit", "open.okina.uz"]);

/** Explicitly allowed staging hosts (subdomains of production brand). */
const STAGING_HOST_ALLOWLIST = new Set(["staging.lexify.zonic.fit"]);

export function resolveBaseURL(): string {
  const raw =
    process.env.TEST_BASE_URL?.trim() ||
    process.env.PLAYWRIGHT_BASE_URL?.trim() ||
    "http://localhost:3000";

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid TEST_BASE_URL / PLAYWRIGHT_BASE_URL: ${raw}`);
  }

  const host = url.hostname.toLowerCase();

  if (STAGING_HOST_ALLOWLIST.has(host)) {
    return url.origin;
  }

  if (PRODUCTION_HOSTS.has(host)) {
    throw new Error(
      `Refusing to run browser E2E against production host "${host}". ` +
        `Use local (http://localhost:3000) or staging (https://staging.lexify.zonic.fit).`,
    );
  }

  // Any other *.lexify.zonic.fit that is not allowlisted is treated as production-adjacent.
  if (host.endsWith(".lexify.zonic.fit") || host.endsWith(".open.okina.uz")) {
    throw new Error(
      `Refusing E2E against unlisted Lexify host "${host}". ` +
        `Add it to STAGING_HOST_ALLOWLIST only after confirming it is non-production.`,
    );
  }

  return url.origin;
}

export type RoleCreds = { email: string; password: string };

function readCreds(emailKey: string, passwordKey: string): RoleCreds | null {
  const email = process.env[emailKey]?.trim();
  const password = process.env[passwordKey];
  if (!email || !password) return null;
  return { email, password };
}

export function studentCreds(): RoleCreds | null {
  return readCreds("E2E_STUDENT_EMAIL", "E2E_STUDENT_PASSWORD");
}

export function teacherCreds(): RoleCreds | null {
  return readCreds("E2E_TEACHER_EMAIL", "E2E_TEACHER_PASSWORD");
}

export function adminCreds(): RoleCreds | null {
  return readCreds("E2E_ADMIN_EMAIL", "E2E_ADMIN_PASSWORD");
}

/** Checkout V2 browser tests must stay skipped unless explicitly enabled. */
export function isCheckoutV2E2EEnabled(): boolean {
  const v = process.env.E2E_CHECKOUT_V2_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * Role / course / lesson smoke needs a DB whose applied migrations match
 * the current Prisma schema (and seeded fixtures). Local schema drift
 * currently includes missing `users.last_login_at`, `entitlements`,
 * `lessons.recording_url`, etc. — set E2E_DB_READY=1 only when the target
 * DB is known-good (e.g. fully migrated staging or aligned local).
 */
export function isE2EDbReady(): boolean {
  const v = process.env.E2E_DB_READY?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function skipReasonDbNotReady(): string {
  return (
    "Skipped: E2E_DB_READY is not set. Local Prisma schema is ahead of applied migrations " +
    "(e.g. missing users.last_login_at / entitlements / lessons.recording_url). " +
    "See docs/qa/BROWSER-E2E.md."
  );
}

export function skipReasonMissingCreds(role: "student" | "teacher" | "admin"): string {
  const map = {
    student: "E2E_STUDENT_EMAIL / E2E_STUDENT_PASSWORD",
    teacher: "E2E_TEACHER_EMAIL / E2E_TEACHER_PASSWORD",
    admin: "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD",
  } as const;
  return `Missing ${map[role]}. See docs/qa/BROWSER-E2E.md (local seed accounts).`;
}
