import { prisma } from "@/lib/prisma";

export async function getTeacherForUser(userId: string) {
  return prisma.teacher.findUnique({
    where: { userId },
  });
}
