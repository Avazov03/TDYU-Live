import { AppShell } from "@/components/layout/AppShell";
import { LiveShortsFeed } from "@/components/shorts/LiveShortsFeed";
import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/access";
import { canWatchLive } from "@/lib/tariffs";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ShortsPage() {
  const { user, sub } = await requireAppUser("/shorts");
  if (user.role === "student" && (!sub || !canWatchLive(sub.tier))) {
    return (
      <AppShell active="shorts">
        <div className="empty">
          Jonli efir 2 va 3-tarifda.{" "}
          <Link href="/#tariflar" style={{ color: "var(--accent)" }}>Tarifni oshirish</Link>
        </div>
      </AppShell>
    );
  }

  const lives = await prisma.lesson.findMany({
    where: {
      status: "live",
      course: user.role === "student" && sub ? { id: sub.courseId } : { isPublished: true },
    },
    include: { course: { include: { teacher: { select: { id: true, fullName: true } } } } },
    orderBy: { scheduledAt: "desc" },
  });

  const items = lives.map((l) => ({
    id: l.id,
    titleUz: l.titleUz,
    teacherName: l.course.teacher.fullName,
    teacherId: l.course.teacher.id,
    playbackId: l.muxLivePlaybackId,
    viewHint: l.course.titleUz,
  }));

  return (
    <AppShell active="shorts" mainClassName={items.length > 0 ? "shorts-main" : undefined}>
      {items.length === 0 ? (
        <div className="empty" style={{ padding: 24 }}>
          Hozircha jonli efir yo&apos;q. O&apos;qituvchi efirni boshlagach shu yerda ochiladi.
        </div>
      ) : (
        <LiveShortsFeed shorts={items} />
      )}
    </AppShell>
  );
}
