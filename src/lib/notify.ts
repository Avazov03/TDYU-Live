import type { NotificationType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

type NotifyInput = {
  userId: string;
  type: NotificationType;
  titleUz: string;
  messageUz: string;
  relatedId?: string;
  email?: string | null;
  telegramChatId?: string | null;
};

export async function sendTelegram(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  }).catch(() => null);
  return Boolean(res?.ok);
}

export async function notifyUser(input: NotifyInput) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { email: true, telegramChatId: true },
  });

  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      titleUz: input.titleUz,
      messageUz: input.messageUz,
      relatedId: input.relatedId ?? null,
    },
  });

  const email = input.email ?? user?.email ?? null;
  const telegramChatId = input.telegramChatId ?? user?.telegramChatId ?? null;
  const text = `<b>${input.titleUz}</b>\n${input.messageUz}`;

  if (telegramChatId) await sendTelegram(telegramChatId, text);
  if (email) await sendEmail(email, input.titleUz, input.messageUz);
}

export async function notifyCourseStudents(
  courseId: string,
  payload: Omit<NotifyInput, "userId" | "email" | "telegramChatId">,
  minTier?: "t1" | "t2" | "t3",
) {
  const now = new Date();
  const subs = await prisma.subscription.findMany({
    where: {
      courseId,
      endsAt: { gt: now },
      ...(minTier === "t2" ? { tier: { in: ["t2", "t3"] } } : {}),
      ...(minTier === "t3" ? { tier: "t3" } : {}),
    },
    include: { user: { select: { id: true, email: true, telegramChatId: true } } },
  });

  for (const sub of subs) {
    await notifyUser({
      ...payload,
      userId: sub.user.id,
      email: sub.user.email,
      telegramChatId: sub.user.telegramChatId,
    });
  }
}

export async function notifyTeacherOfCourse(
  courseId: string,
  payload: Omit<NotifyInput, "userId" | "email" | "telegramChatId">,
) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      teacher: {
        include: { user: { select: { id: true, email: true, telegramChatId: true } } },
      },
    },
  });
  const user = course?.teacher.user;
  if (!user) return;
  await notifyUser({
    ...payload,
    userId: user.id,
    email: user.email,
    telegramChatId: user.telegramChatId,
  });
}
