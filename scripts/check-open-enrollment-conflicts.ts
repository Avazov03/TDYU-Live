/**
 * Read-only: detect open-enrollment duplicates that would block partial unique index.
 * Usage: npx tsx scripts/check-open-enrollment-conflicts.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL required");

  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const conflicts = await prisma.$queryRaw<
      { user_id: string; course_id: string; n: number; ids: string[]; statuses: string[] }[]
    >`
      SELECT user_id, course_id, COUNT(*)::int AS n,
             array_agg(id::text) AS ids,
             array_agg(status::text) AS statuses
      FROM enrollments
      WHERE access_open = true AND status IN ('active', 'completed')
      GROUP BY user_id, course_id
      HAVING COUNT(*) > 1
    `;

    const paymentCount = await prisma.payment.count();
    const openCount = await prisma.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM enrollments
      WHERE access_open = true AND status IN ('active', 'completed')
    `;

    console.log(
      JSON.stringify(
        {
          openEnrollmentConflicts: conflicts.length,
          conflicts,
          paymentCount,
          openEnrollmentCount: openCount[0]?.n ?? 0,
        },
        null,
        2,
      ),
    );

    if (conflicts.length > 0) {
      process.exitCode = 2;
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
