/**
 * Production admin yaratish (seed o'rniga).
 *
 * Ishlatish:
 *   npx tsx scripts/create-admin.ts admin@tdyu.live "KuchliParol123" "Admin Ism"
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
    console.error('Usage: npx tsx scripts/create-admin.ts <email> <password> [fullName]');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Parol kamida 8 belgidan iborat bo'lishi kerak.");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.error(`Bu email allaqachon mavjud: ${email}`);
    process.exit(1);
  }

  const user = await prisma.user.create({
    data: {
      email,
      fullName,
      passwordHash: await hashPassword(password),
      role: "admin",
    },
    select: { id: true, email: true, fullName: true, role: true },
  });

  console.log("Admin muvaffaqiyatli yaratildi:");
  console.log(user);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
