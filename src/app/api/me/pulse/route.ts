import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getStudentOwnedCourseIds } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { telegramDeepLink } from "@/lib/telegram/link-token";

export const dynamic = "force-dynamic";

export type PulseLive = {
  lessonId: string;
  title: string;
  courseTitle: string;
  state: "live" | "lobby";
  scheduledAt: string;
  startedAt: string | null;
};

export type PulseResponse =
  | { loggedIn: false }
  | {
      loggedIn: true;
      role: "student" | "teacher" | "admin";
      unread: number;
      telegram: { linked: boolean; link: string | null };
      live: PulseLive[];
    };

async function liveLessonsFor(userId: string): Promise<PulseLive[]> {
  const courseIds = await getStudentOwnedCourseIds(userId);
  if (courseIds.length === 0) return [];
  const rows = await prisma.lesson.findMany({
    where: { courseId: { in: courseIds }, status: { in: ["live", "lobby", "waiting_room"] } },
    select: {
      id: true,
      titleUz: true,
      status: true,
      scheduledAt: true,
      course: { select: { titleUz: true } },
      liveSessions: {
        where: { status: { in: ["waiting", "live", "paused"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { sessionStartedAt: true },
      },
    },
    orderBy: { scheduledAt: "asc" },
    take: 5,
  });
  return rows
    .map((l) => ({
      lessonId: l.id,
      title: l.titleUz,
      courseTitle: l.course.titleUz,
      state: l.status === "live" ? ("live" as const) : ("lobby" as const),
      scheduledAt: l.scheduledAt.toISOString(),
      startedAt: l.liveSessions[0]?.sessionStartedAt?.toISOString() ?? null,
    }))
    .sort((a, b) => (a.state === b.state ? 0 : a.state === "live" ? -1 : 1));
}

/** Lightweight poll for the global live banner, bell badge and Telegram nudge. */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ loggedIn: false } satisfies PulseResponse);

  const [user, unread] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { role: true, telegramChatId: true } }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);
  if (!user) return NextResponse.json({ loggedIn: false } satisfies PulseResponse);

  const linked = Boolean(user.telegramChatId);
  const body: PulseResponse = {
    loggedIn: true,
    role: user.role,
    unread,
    telegram: { linked, link: linked ? null : telegramDeepLink(userId) },
    live: user.role === "student" ? await liveLessonsFor(userId) : [],
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
