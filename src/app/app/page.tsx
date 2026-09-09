import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { HomeContent } from "@/components/home/HomeContent";
import type { VideoCardData } from "@/components/video/VideoCard";
import { requireStudentCabinet } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { TARIFF_APP_HINTS, TARIFF_LABELS, canWatchLive } from "@/lib/tariffs";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function StudentAppPage() {
  const { sub } = await requireStudentCabinet("/app");
  const liveOk = canWatchLive(sub.tier);

  const lessons = await prisma.lesson.findMany({
    where: { courseId: sub.courseId },
    orderBy: [{ status: "asc" }, { scheduledAt: "desc" }],
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
  });

  const live = lessons.filter((l) => l.status === "live");
  const rest = lessons.filter((l) => l.status !== "live");
  const ordered = [...live, ...rest];

  const videos: VideoCardData[] = ordered.map((l) => ({
    id: l.id,
    titleUz: l.titleUz,
    href: `/learn/${l.id}`,
    teacherName: l.course.teacher.fullName,
    metaLine: l.course.subject.nameUz,
    viewCount: l._count.attendance || undefined,
    createdAt: l.scheduledAt,
    playbackId: l.muxVodPlaybackId || l.muxLivePlaybackId,
    live: l.status === "live",
    locked: Boolean(l.status === "live" && !liveOk),
  }));

  return (
    <AppShell active="home">
      <div className="cabinet-banner">
        <span className="badge accent">{TARIFF_LABELS[sub.tier]}</span>
        <span className="small muted">
          {sub.course.teacher.fullName} · {sub.course.titleUz}
        </span>
        <span className="small muted">{TARIFF_APP_HINTS[sub.tier]}</span>
        <Link href="/schedule" className="btn btn-sm">
          Dars reja
        </Link>
      </div>
      {live.length > 0 && liveOk ? (
        <p className="small" style={{ marginBottom: 12, color: "var(--danger)" }}>
          Jonli dars ketmoqda — pastdagi «JONLI» kartani oching.
        </p>
      ) : null}
      {live.length > 0 && !liveOk ? (
        <p className="small muted" style={{ marginBottom: 12 }}>
          Jonli dars boshlandi. 1-tarifda yozuv tugagach ochiladi.
        </p>
      ) : null}
      {videos.length === 0 ? (
        <div className="empty">O&apos;qituvchingiz hali dars qo&apos;shmagan. Jadvalni kuzating.</div>
      ) : (
        <Suspense fallback={<div className="empty">Yuklanmoqda...</div>}>
          <HomeContent chips={["Hammasi"]} videos={videos} facultyMap={{}} />
        </Suspense>
      )}
    </AppShell>
  );
}
