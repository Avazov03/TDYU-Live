import "dotenv/config";
import { createSeedClient } from "../src/lib/prisma";

const prisma = createSeedClient();

const DEMO_EMAILS = ["bekzod.n@gmail.com"];

async function main() {
  await prisma.teacherInvite.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.certificate.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.lesson.deleteMany();

  await prisma.user.deleteMany({
    where: { email: { in: DEMO_EMAILS } },
  });

  console.log("Demo darslar, to'lovlar va talaba kontenti tozalandi. Admin/o'qituvchi saqlanadi.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
