/**
 * Admin hisobini yaratish/yangilash.
 *   npx tsx scripts/upsert-admin.ts <email> <password> [fullName]
 */
import "dotenv/config";
import { createSeedClient } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/password";

const prisma = createSeedClient();

async function main() {
  const email = process.argv[2]?.toLowerCase().trim();
  const password = process.argv[3];
  const fullName = process.argv[4]?.trim() || "Administrator";

  if (!email || !password) {
    console.error('Usage: npx tsx scripts/upsert-admin.ts <email> <password> [fullName]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Parol kamida 8 belgidan iborat bo'lishi kerak.");
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "admin", isBlocked: false, fullName },
    create: { email, passwordHash, role: "admin", fullName },
    select: { id: true, email: true, fullName: true, role: true },
  });
  console.log("Admin tayyor:", user.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
