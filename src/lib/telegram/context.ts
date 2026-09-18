import { prisma } from "@/lib/prisma";
import { TARIFF_SHORT, isSubscriptionActive } from "@/lib/tariffs";
import { formatDateTime } from "@/lib/utils";
import { statusLabel, type PlanStatus } from "@/lib/plan";
import type { InlineKeyboard } from "@/lib/telegram/api";
import { siteBaseUrl } from "@/lib/telegram/api";

export type BotUserContext = {
  chatId: string;
  linked: boolean;
  user: {
    id: string;
    fullName: string;
    role: string;
    email: string;
  } | null;
  entitlementTier: string | null;
  subscriptions: {
    courseId: string;
    courseTitle: string;
    teacherName: string;
    tier: string;
    endsAt: Date;
  }[];
  teacher: {
    id: string;
    courseCount: number;
    pendingGrades: number;
    nextLesson: {
      id: string;
      titleUz: string;
      courseTitle: string;
      scheduledAt: Date;
      status: string;
    } | null;
  } | null;
};

export async function loadBotContext(chatId: string | number): Promise<BotUserContext> {
  const id = String(chatId);
  const user = await prisma.user.findFirst({
    where: { telegramChatId: id },
    select: {
      id: true,
      fullName: true,
      role: true,
      email: true,
      entitlement: { select: { tier: true, endsAt: true } },
      subscriptions: {
        where: { endsAt: { gt: new Date() } },
        include: {
          course: {
            include: { teacher: { select: { fullName: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      teacherProfile: {
        select: {
          id: true,
          courses: {
            select: {
              id: true,
              titleUz: true,
              lessons: {
                where: { status: { in: ["scheduled", "lobby", "live"] } },
                orderBy: { scheduledAt: "asc" },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    return {
      chatId: id,
      linked: false,
      user: null,
      entitlementTier: null,
      subscriptions: [],
      teacher: null,
    };
  }

  const entOk =
    user.entitlement && isSubscriptionActive(user.entitlement.endsAt)
      ? user.entitlement.tier
      : null;

  let pendingGrades = 0;
  let nextLesson: {
    id: string;
    titleUz: string;
    courseTitle: string;
    scheduledAt: Date;
    status: string;
  } | null = null;

  if (user.teacherProfile) {
    pendingGrades = await prisma.submission.count({
      where: {
        grade: null,
        assignment: { course: { teacherId: user.teacherProfile.id } },
      },
    });
    const next = user.teacherProfile.courses
      .flatMap((c) =>
        c.lessons.map((l) => ({
          id: l.id,
          titleUz: l.titleUz,
          courseTitle: c.titleUz,
          scheduledAt: l.scheduledAt,
          status: l.status,
        })),
      )
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())[0];
    nextLesson = next ?? null;
  }

  return {
    chatId: id,
    linked: true,
    user: {
      id: user.id,
      fullName: user.fullName,
      role: user.role,
      email: user.email,
    },
    entitlementTier: entOk,
    subscriptions: user.subscriptions.map((s) => ({
      courseId: s.courseId,
      courseTitle: s.course.titleUz,
      teacherName: s.course.teacher.fullName,
      tier: s.tier,
      endsAt: s.endsAt,
    })),
    teacher: user.teacherProfile
      ? {
          id: user.teacherProfile.id,
          courseCount: user.teacherProfile.courses.length,
          pendingGrades,
          nextLesson,
        }
      : null,
  };
}

export function mainMenuKeyboard(ctx: BotUserContext): InlineKeyboard {
  const base = siteBaseUrl();
  const rows: InlineKeyboard = [
    [
      { text: "📅 Bugun", callback_data: "m:today" },
      { text: "📚 Kurslarim", callback_data: "m:courses" },
    ],
    [
      { text: "👤 Holat", callback_data: "m:status" },
      { text: "❓ Yordam", callback_data: "m:help" },
    ],
    [{ text: "🌐 Lexify ochish", url: `${base}/app` }],
  ];
  if (ctx.teacher) {
    rows.splice(1, 0, [
      { text: "🎬 Studio", callback_data: "m:studio" },
      { text: "📋 Reja", url: `${base}/teacher/reja` },
    ]);
  }
  if (ctx.linked) {
    rows.push([{ text: "🔓 Uzish", callback_data: "m:unlink_ask" }]);
  } else {
    rows.push([{ text: "🔗 Sozlamalarda ulash", url: `${base}/settings` }]);
  }
  return rows;
}

export function formatStatus(ctx: BotUserContext) {
  if (!ctx.linked || !ctx.user) {
    return (
      `<b>Lexify bot</b>\n` +
      `Akkaunt ulanmagan.\n` +
      `Saytda Sozlamalar → «Botni ulash» yoki Chat ID saqlang.`
    );
  }

  const lines = [
    `<b>${esc(ctx.user.fullName)}</b>`,
    `Rol: <b>${roleLabel(ctx.user.role)}</b>`,
  ];

  if (ctx.entitlementTier) {
    lines.push(`Platforma tarifi: <b>${TARIFF_SHORT[ctx.entitlementTier as keyof typeof TARIFF_SHORT] ?? ctx.entitlementTier}</b>`);
  }

  if (ctx.subscriptions.length) {
    lines.push("");
    lines.push("<b>Kurslar:</b>");
    for (const s of ctx.subscriptions.slice(0, 8)) {
      lines.push(
        `• ${esc(s.courseTitle)} — ${esc(s.teacherName)} · ${TARIFF_SHORT[s.tier as keyof typeof TARIFF_SHORT] ?? s.tier}`,
      );
    }
  } else if (ctx.user.role === "student") {
    lines.push("");
    lines.push("Hali kurs obunasi yo‘q. Onboardingda o‘qituvchi tanlang.");
  }

  if (ctx.teacher) {
    lines.push("");
    lines.push(`<b>Studio:</b> ${ctx.teacher.courseCount} kurs`);
    if (ctx.teacher.pendingGrades > 0) {
      lines.push(`Tekshiruv kutayotgan: <b>${ctx.teacher.pendingGrades}</b>`);
    }
    if (ctx.teacher.nextLesson) {
      const n = ctx.teacher.nextLesson;
      lines.push(
        `Keyingi: ${esc(n.titleUz)} · ${statusLabel(n.status as PlanStatus)} · ${formatDateTime(n.scheduledAt)}`,
      );
    }
  }

  return lines.join("\n");
}

export async function formatToday(ctx: BotUserContext) {
  const base = siteBaseUrl();
  if (!ctx.linked || !ctx.user) {
    return { text: "Avval akkauntni ulang (/start yoki Sozlamalar).", keyboard: mainMenuKeyboard(ctx) };
  }

  const now = new Date();
  const in2d = new Date(now.getTime() + 2 * 86400_000);

  if (ctx.teacher) {
    const lessons = await prisma.lesson.findMany({
      where: {
        course: { teacherId: ctx.teacher.id },
        status: { in: ["scheduled", "lobby", "live"] },
        scheduledAt: { lte: in2d },
      },
      include: { course: { select: { titleUz: true } } },
      orderBy: { scheduledAt: "asc" },
      take: 6,
    });
    if (!lessons.length) {
      return {
        text: "Yaqin 2 kunda dars yo‘q. Rejada yangi mavzu qo‘shing.",
        keyboard: [
          ...mainMenuKeyboard(ctx).slice(0, 2),
          [{ text: "➕ Reja", url: `${base}/teacher/reja` }],
        ] as InlineKeyboard,
      };
    }
    const lines = ["<b>Yaqin darslaringiz</b>", ""];
    const keys: InlineKeyboard = [];
    for (const l of lessons) {
      lines.push(
        `• <b>${esc(l.titleUz)}</b>\n  ${esc(l.course.titleUz)} · ${statusLabel(l.status as PlanStatus)} · ${formatDateTime(l.scheduledAt)}`,
      );
      keys.push([{ text: `▶ ${l.titleUz.slice(0, 28)}`, url: `${base}/teacher#live` }]);
    }
    keys.push([{ text: "🏠 Menyu", callback_data: "m:home" }]);
    return { text: lines.join("\n"), keyboard: keys };
  }

  const courseIds = ctx.subscriptions.map((s) => s.courseId);
  if (!courseIds.length) {
    return {
      text: "Kurs yo‘q. Lexify’da o‘qituvchi tanlang.",
      keyboard: [[{ text: "Tariflar", url: `${base}/#tariflar` }], [{ text: "🏠 Menyu", callback_data: "m:home" }]],
    };
  }

  const lessons = await prisma.lesson.findMany({
    where: {
      courseId: { in: courseIds },
      OR: [
        { status: { in: ["lobby", "live"] } },
        { status: "scheduled", scheduledAt: { gte: now, lte: in2d } },
      ],
    },
    include: {
      course: { include: { teacher: { select: { fullName: true } } } },
    },
    orderBy: { scheduledAt: "asc" },
    take: 8,
  });

  if (!lessons.length) {
    return {
      text: "Yaqin 2 kunda dars yo‘q. Rejani saytda ko‘ring.",
      keyboard: [
        [{ text: "📅 Dars reja", url: `${base}/schedule` }],
        [{ text: "🏠 Menyu", callback_data: "m:home" }],
      ],
    };
  }

  const lines = ["<b>Bugun / yaqin darslar</b>", ""];
  const keys: InlineKeyboard = [];
  for (const l of lessons) {
    lines.push(
      `• <b>${esc(l.titleUz)}</b>\n  ${esc(l.course.teacher.fullName)} · ${statusLabel(l.status as PlanStatus)} · ${formatDateTime(l.scheduledAt)}`,
    );
    keys.push([{ text: `Kirish · ${l.titleUz.slice(0, 24)}`, url: `${base}/learn/${l.id}` }]);
  }
  keys.push([{ text: "🏠 Menyu", callback_data: "m:home" }]);
  return { text: lines.join("\n"), keyboard: keys };
}

export function formatCourses(ctx: BotUserContext) {
  const base = siteBaseUrl();
  if (!ctx.linked || !ctx.user) {
    return { text: "Avval akkauntni ulang.", keyboard: mainMenuKeyboard(ctx) };
  }
  if (ctx.teacher) {
    return {
      text: `<b>Studio kurslari:</b> ${ctx.teacher.courseCount} ta\nBatafsil saytda.`,
      keyboard: [
        [{ text: "🎬 Studio", url: `${base}/teacher` }],
        [{ text: "📋 Reja", url: `${base}/teacher/reja` }],
        [{ text: "🏠 Menyu", callback_data: "m:home" }],
      ] as InlineKeyboard,
    };
  }
  if (!ctx.subscriptions.length) {
    return {
      text: "Obuna bo‘lgan kurs yo‘q.",
      keyboard: [
        [{ text: "Kurs tanlash", url: `${base}/onboard` }],
        [{ text: "🏠 Menyu", callback_data: "m:home" }],
      ],
    };
  }
  const lines = ["<b>Kurslarim</b>", ""];
  const keys: InlineKeyboard = [];
  for (const s of ctx.subscriptions) {
    lines.push(
      `• <b>${esc(s.courseTitle)}</b>\n  ${esc(s.teacherName)} · ${TARIFF_SHORT[s.tier as keyof typeof TARIFF_SHORT] ?? s.tier}`,
    );
    keys.push([{ text: s.courseTitle.slice(0, 32), url: `${base}/courses/${s.courseId}` }]);
  }
  keys.push([{ text: "🏠 Menyu", callback_data: "m:home" }]);
  return { text: lines.join("\n"), keyboard: keys };
}

export function formatHelp(ctx: BotUserContext) {
  return [
    "<b>Lexify bot — yordam</b>",
    "",
    "/start — menyu / ulash",
    "/status — tarif, kurslar, rol",
    "/bugun — yaqin darslar",
    "/kurslar — kurslarim",
    "/unlink — Telegramni uzish",
    "",
    "Eslatmalar: dars oldidan, kutish xonasi, jonli efir, yozuv.",
    ctx.teacher ? "Ustoz: Studio va Reja tugmalari ochiq." : "Talaba: faqat o‘z kurslaringiz bo‘yicha xabar.",
  ].join("\n");
}

function roleLabel(role: string) {
  if (role === "teacher") return "O‘qituvchi";
  if (role === "admin") return "Admin";
  return "Talaba";
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
