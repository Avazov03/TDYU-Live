import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { coverUrl } from "@/lib/thumbs";

export type SearchSuggestItem =
  | { type: "video"; id: string; label: string; sublabel?: string; thumbnail: string }
  | { type: "teacher"; id: string; label: string; sublabel?: string }
  | { type: "topic"; id: string; label: string };

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json({ suggestions: [], topVideo: null });

  const [lessons, teachers, courses] = await Promise.all([
    prisma.lesson.findMany({
      where: {
        course: { isPublished: true },
        OR: [
          { titleUz: { contains: q, mode: "insensitive" } },
          { course: { titleUz: { contains: q, mode: "insensitive" } } },
        ],
      },
      include: {
        course: { include: { teacher: { select: { fullName: true } } } },
      },
      take: 6,
      orderBy: { scheduledAt: "desc" },
    }),
    prisma.teacher.findMany({
      where: { fullName: { contains: q, mode: "insensitive" } },
      take: 4,
    }),
    prisma.course.findMany({
      where: { isPublished: true, titleUz: { contains: q, mode: "insensitive" } },
      take: 3,
    }),
  ]);

  const suggestions: SearchSuggestItem[] = [
    ...lessons.map((l) => ({
      type: "video" as const,
      id: l.id,
      label: l.titleUz,
      sublabel: l.course.teacher.fullName,
      thumbnail: coverUrl(l.id, l.titleUz, l.muxVodPlaybackId || l.muxLivePlaybackId),
    })),
    ...teachers.map((t) => ({
      type: "teacher" as const,
      id: t.id,
      label: t.fullName,
      sublabel: "O'qituvchi",
    })),
    ...courses.map((c) => ({
      type: "topic" as const,
      id: c.id,
      label: c.titleUz,
    })),
  ];

  const top = lessons[0];
  return NextResponse.json({
    suggestions,
    topVideo: top
      ? {
          id: top.id,
          thumbnail: coverUrl(top.id, top.titleUz, top.muxVodPlaybackId || top.muxLivePlaybackId),
        }
      : null,
  });
}
