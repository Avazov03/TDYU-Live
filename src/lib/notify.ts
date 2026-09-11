import type { NotificationType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type NotifyInput = {
  userId: string;
  type: NotificationType;
  titleUz: string;
  messageUz: string;
  relatedId?: string;
  email?: string | null;
  telegramChatId?: string | null;
};

async function sendTelegram(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch(() => undefined);
}

async function sendEmail(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "LexLive <noreply@localhost>";
  if (!key) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, text }),
  }).catch(() => undefined);
}

export async function notifyUser(input: NotifyInput) {
  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      titleUz: input.titleUz,
      messageUz: input.messageUz,
      relatedId: input.relatedId ?? null,
    },
  });

  const text = `${input.titleUz}\n${input.messageUz}`;
  if (input.telegramChatId) await sendTelegram(input.telegramChatId, text);
  if (input.email) await sendEmail(input.email, input.titleUz, input.messageUz);
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
