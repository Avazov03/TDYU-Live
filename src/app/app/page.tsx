import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { HomeContent } from "@/components/home/HomeContent";
import type { VideoCardData } from "@/components/video/VideoCard";
import { requireStudentCabinet } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { fakeDurationSec, fakeViews } from "@/lib/thumbs";
import { TARIFF_APP_HINTS, TARIFF_LABELS, canWatchLive } from "@/lib/tariffs";

export const dynamic = "force-dynamic";

async function getHomeData() {
  try {
    const [faculties, lessons] = await Promise.all([
      prisma.faculty.findMany({ orderBy: { order: "asc" } }),
      prisma.lesson.findMany({
        where: { course: { isPublished: true } },
        orderBy: { scheduledAt: "desc" },
        include: {
          course: {
            include: {
              teacher: { select: { fullName: true } },
              faculty: { select: { id: true, nameUz: true } },
              subject: { select: { nameUz: true } },
            },
          },
          _count: { select: { attendance: true } },
        },
      }),
    ]);

    const chips = ["Hammasi", ...faculties.map((f) => f.nameUz)];
    const facultyMap: Record<string, string[]> = {};
    for (const f of faculties) {
      facultyMap[f.nameUz] = lessons.filter((l) => l.course.faculty.id === f.id).map((l) => l.id);
    }

    const videos: VideoCardData[] = lessons.map((l) => ({
      id: l.id,
      titleUz: l.titleUz,
      href: `/learn/${l.id}`,
      teacherName: l.course.teacher.fullName,
      metaLine: `${l.course.subject.nameUz}`,
      durationSec: fakeDurationSec(l.id),
      viewCount: fakeViews(l.id, l._count.attendance),
      createdAt: l.scheduledAt,
      playbackId: l.muxVodPlaybackId || l.muxLivePlaybackId,
      live: l.status === "live",
    }));

    return { ok: true as const, chips, videos, facultyMap };
  } catch {
    return { ok: false as const };
  }
}

export default async function StudentAppPage() {
  const { sub } = await requireStudentCabinet("/app");
  const liveOk = canWatchLive(sub.tier);
  const data = await getHomeData();
  const videos = data.ok
    ? data.videos.map((v) => ({ ...v, locked: Boolean(v.live && !liveOk) }))
    : [];

  return (
    <AppShell active="home">
      <div className="cabinet-banner">
        <span className="badge accent">{TARIFF_LABELS[sub.tier]}</span>
        <span className="small muted">{sub.course.titleUz}</span>
        <span className="small muted">{TARIFF_APP_HINTS[sub.tier]}</span>
      </div>
      {data.ok ? (
        <Suspense fallback={<div className="empty">Yuklanmoqda...</div>}>
          <HomeContent chips={data.chips} videos={videos} facultyMap={data.facultyMap} />
        </Suspense>
      ) : (
        <div className="empty">Darslar yuklanmadi.</div>
      )}
    </AppShell>
  );
}
