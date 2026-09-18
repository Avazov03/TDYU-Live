import type { NotificationType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { sendTelegramMessage, siteBaseUrl, type InlineKeyboard } from "@/lib/telegram/api";

type NotifyInput = {
  userId: string;
  type: NotificationType;
  titleUz: string;
  messageUz: string;
  relatedId?: string;
  email?: string | null;
  telegramChatId?: string | null;
};

export async function sendTelegram(chatId: string, text: string, keyboard?: InlineKeyboard) {
  const res = await sendTelegramMessage(chatId, text, { keyboard });
  return Boolean(res.ok);
}

function keyboardFor(type: NotificationType, relatedId?: string | null): InlineKeyboard | undefined {
  if (!relatedId) return undefined;
  const base = siteBaseUrl();
  if (type === "lesson_live" || type === "lesson_starting") {
    return [[{ text: "▶ Darsga kirish", url: `${base}/learn/${relatedId}` }]];
  }
  if (type === "assignment") {
    return [[{ text: "📝 Topshiriqlar", url: `${base}/assignments` }]];
  }
  if (type === "certificate") {
    return [[{ text: "🎓 Sertifikat", url: `${base}/certificates/${relatedId}` }]];
  }
  if (type === "grade") {
    return [[{ text: "📚 Kabinet", url: `${base}/app` }]];
  }
  return [[{ text: "🌐 Lexify", url: base }]];
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

  if (telegramChatId) {
    await sendTelegram(
      telegramChatId,
      text,
      keyboardFor(input.type, input.relatedId),
    );
  }
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
