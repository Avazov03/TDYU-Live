/**
 * Staging/local ONLY — refreshes the Enrollment-authoritative access fixtures for `e2e/access`
 * (scenarios: scripts/lib/e2e-access-seed.ts). Idempotent; never deletes users or other data.
 *
 * Refuses unless the database name ends with `_staging`, or the target is a non-production local DB.
 *
 * Usage (staging app dir):  npx tsx scripts/e2e-access-fixtures.ts
 */

import "dotenv/config";
import { createSeedClient } from "../src/lib/prisma";
import { seedAccessFixtures } from "./lib/e2e-access-seed";

function assertSafeTarget() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set");
  const url = new URL(raw);
  const db = url.pathname.replace(/^\//, "");
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  const staging = db.endsWith("_staging");
  const localDev = local && process.env.NODE_ENV !== "production" && !/lexify\.zonic\.fit/i.test(process.env.NEXTAUTH_URL ?? "");
  if (!staging && !localDev) {
    throw new Error(`Refusing to write access fixtures to database "${db}" (not *_staging / local dev).`);
  }
  return db;
}

async function main() {
  const db = assertSafeTarget();
  const prisma = createSeedClient();
  try {
    const result = await seedAccessFixtures(prisma);
    console.log(JSON.stringify({ ok: true, db, ...result }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
