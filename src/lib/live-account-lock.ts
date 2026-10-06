import { prisma } from "@/lib/prisma";

/** Latest device wins. The previous instance learns it lost on its next poll. */
export async function claimLiveAccountLock(input: {
  userId: string;
  lessonId: string;
  instanceId: string;
}): Promise<void> {
  await prisma.liveAccountLock.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      lessonId: input.lessonId,
      instanceId: input.instanceId,
    },
    update: { lessonId: input.lessonId, instanceId: input.instanceId },
  });
}

export async function liveAccountLockStatus(input: {
  userId: string;
  lessonId: string;
  instanceId: string;
}): Promise<"current" | "superseded"> {
  const row = await prisma.liveAccountLock.findUnique({ where: { userId: input.userId } });
  if (!row) return "superseded";
  if (row.lessonId !== input.lessonId || row.instanceId !== input.instanceId) return "superseded";
  return "current";
}
