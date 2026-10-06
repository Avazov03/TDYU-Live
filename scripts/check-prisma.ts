import { config } from "dotenv";
config({ path: ".env" });

async function main() {
  console.log("DATABASE_URL set?", Boolean(process.env.DATABASE_URL));
  const { prisma } = await import("../src/lib/prisma");
  const n = await prisma.user.count();
  console.log("users", n);
  await prisma.$disconnect();
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
