/**
 * Shared env handling for Phase 8.1 recording CLIs.
 * Loads --env-file before any prisma import. Never prints secret values.
 */

import { config as loadEnv } from "dotenv";

export function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

export function loadScriptEnv(): void {
  const envFile = argValue("--env-file") || process.env.ENV_FILE;
  if (envFile) loadEnv({ path: envFile, override: true });
  else loadEnv();
}

export function dbName(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? "").pathname.replace(/^\//, "");
  } catch {
    return "";
  }
}

export function isProductionTarget(): boolean {
  return dbName() === "tdyulive" || process.env.PORT === "3100" || process.env.LEXIFY_ENV === "production";
}

export function credentialStatus() {
  const s = (v: string | undefined) => (v?.trim() ? "AVAILABLE" : "MISSING");
  return {
    MUX_API: process.env.MUX_TOKEN_ID?.trim() && process.env.MUX_TOKEN_SECRET?.trim() ? "AVAILABLE" : "MISSING",
    MUX_SIGNING: s(process.env.MUX_SIGNING_KEY_ID) === "AVAILABLE" && s(process.env.MUX_SIGNING_PRIVATE_KEY) === "AVAILABLE"
      ? "AVAILABLE"
      : "MISSING",
    RECORDING_STORAGE_ROOT: s(process.env.RECORDING_STORAGE_ROOT),
  };
}

/** Refuse staging DB + production claims, and vice versa. */
export function assertEnvConsistent(): void {
  const name = dbName();
  if (process.env.PORT === "3100" && name.includes("staging")) {
    throw new Error("REFUSING: production port with staging DATABASE_URL");
  }
  if (process.env.PORT === "3101" && name === "tdyulive") {
    throw new Error("REFUSING: staging port with production DATABASE_URL");
  }
}

export function confirmed(envName: string): boolean {
  return process.env[envName] === "true";
}
