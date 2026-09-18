import { prisma } from "@/lib/prisma";
import {
  answerCallbackQuery,
  sendTelegramMessage,
  type TgUpdate,
} from "@/lib/telegram/api";
import {
  formatCourses,
  formatHelp,
  formatStatus,
  formatToday,
  loadBotContext,
  mainMenuKeyboard,
} from "@/lib/telegram/context";

async function linkUser(chatId: string, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, fullName: true },
  });
  if (!user) return null;
  // boshqa userning shu chatini tozalash
  await prisma.user.updateMany({
    where: { telegramChatId: chatId, NOT: { id: user.id } },
    data: { telegramChatId: null },
  });
  await prisma.user.update({
    where: { id: user.id },
    data: { telegramChatId: chatId },
  });
  return user;
}

async function unlinkChat(chatId: string) {
  await prisma.user.updateMany({
    where: { telegramChatId: chatId },
    data: { telegramChatId: null },
  });
}

async function sendHome(chatId: string | number, greeting?: string) {
  const ctx = await loadBotContext(chatId);
  const head =
    greeting ??
    (ctx.linked && ctx.user
      ? `Salom, <b>${ctx.user.fullName}</b> 👋`
      : `<b>Lexify Notify</b>`);
  const body = ctx.linked
    ? `\nBildirishnomalar shu yerda. Pastdan tanlang.`
    : `\nAkkaunt ulanmagan.\nChat ID: <code>${chatId}</code>\nSozlamalarga yozing yoki saytdan «Botni ulash» ni bosing.`;
  await sendTelegramMessage(chatId, `${head}${body}`, {
    keyboard: mainMenuKeyboard(ctx),
  });
}

export async function handleTelegramUpdate(update: TgUpdate) {
  const cb = update.callback_query;
  if (cb?.message?.chat.id != null) {
    const chatId = cb.message.chat.id;
    const data = (cb.data ?? "").trim();
    await answerCallbackQuery(cb.id);

    if (data === "m:home") {
      await sendHome(chatId);
      return;
    }
    if (data === "m:help") {
      const ctx = await loadBotContext(chatId);
      await sendTelegramMessage(chatId, formatHelp(ctx), {
        keyboard: [[{ text: "🏠 Menyu", callback_data: "m:home" }]],
      });
      return;
    }
    if (data === "m:status") {
      const ctx = await loadBotContext(chatId);
      await sendTelegramMessage(chatId, formatStatus(ctx), {
        keyboard: mainMenuKeyboard(ctx),
      });
      return;
    }
    if (data === "m:today" || data === "m:studio") {
      const ctx = await loadBotContext(chatId);
      const today = await formatToday(ctx);
      await sendTelegramMessage(chatId, today.text, { keyboard: today.keyboard });
      return;
    }
    if (data === "m:courses") {
      const ctx = await loadBotContext(chatId);
      const courses = formatCourses(ctx);
      await sendTelegramMessage(chatId, courses.text, { keyboard: courses.keyboard });
      return;
    }
    if (data === "m:unlink_ask") {
      await sendTelegramMessage(
        chatId,
        "Telegramni Lexify akkauntidan uzasizmi?\nEslatmalar kelmay qoladi.",
        {
          keyboard: [
            [
              { text: "✅ Ha, uzish", callback_data: "m:unlink" },
              { text: "◀️ Bekor", callback_data: "m:home" },
            ],
          ],
        },
      );
      return;
    }
    if (data === "m:unlink") {
      await unlinkChat(String(chatId));
      await sendTelegramMessage(chatId, "Ulandi uzildi. Qayta ulash: Sozlamalar → Botni ulash.", {
        keyboard: mainMenuKeyboard(await loadBotContext(chatId)),
      });
      return;
    }
    return;
  }

  const msg = update.message;
  if (!msg?.chat?.id) return;
  const chatId = msg.chat.id;
  const text = (msg.text ?? "").trim();
  if (!text) return;

  const [cmdRaw, ...rest] = text.split(/\s+/);
  const cmd = cmdRaw.split("@")[0].toLowerCase();
  const arg = rest.join(" ").trim();

  if (cmd === "/start") {
    if (arg.startsWith("link_")) {
      const userId = arg.slice(5);
      const user = await linkUser(String(chatId), userId);
      if (user) {
        await sendTelegramMessage(
          chatId,
          `✅ <b>Ulandi</b>, ${user.fullName}!\nDars, kutish xonasi va efir eslatmalari shu yerga keladi.`,
          { keyboard: mainMenuKeyboard(await loadBotContext(chatId)) },
        );
        return;
      }
      await sendTelegramMessage(
        chatId,
        "❌ Havola eskirgan yoki noto‘g‘ri.\nSozlamalardan qayta «Botni ulash» ni bosing.",
      );
      return;
    }
    // oddiy /start — agar chat allaqachon bog‘langan bo‘lsa
    await sendHome(chatId);
    return;
  }

  if (cmd === "/help" || cmd === "/yordam") {
    const ctx = await loadBotContext(chatId);
    await sendTelegramMessage(chatId, formatHelp(ctx), {
      keyboard: [[{ text: "🏠 Menyu", callback_data: "m:home" }]],
    });
    return;
  }

  if (cmd === "/status" || cmd === "/mening" || cmd === "/me") {
    const ctx = await loadBotContext(chatId);
    await sendTelegramMessage(chatId, formatStatus(ctx), {
      keyboard: mainMenuKeyboard(ctx),
    });
    return;
  }

  if (cmd === "/bugun" || cmd === "/today") {
    const ctx = await loadBotContext(chatId);
    const today = await formatToday(ctx);
    await sendTelegramMessage(chatId, today.text, { keyboard: today.keyboard });
    return;
  }

  if (cmd === "/kurslar" || cmd === "/my" || cmd === "/courses") {
    const ctx = await loadBotContext(chatId);
    const courses = formatCourses(ctx);
    await sendTelegramMessage(chatId, courses.text, { keyboard: courses.keyboard });
    return;
  }

  if (cmd === "/unlink" || cmd === "/uzish") {
    await unlinkChat(String(chatId));
    await sendTelegramMessage(chatId, "Telegram uzildi.", {
      keyboard: mainMenuKeyboard(await loadBotContext(chatId)),
    });
    return;
  }

  // noma’lum matn
  await sendTelegramMessage(
    chatId,
    "Tushunmadim. Menyudan tanlang yoki /help yozing.",
    { keyboard: mainMenuKeyboard(await loadBotContext(chatId)) },
  );
}
