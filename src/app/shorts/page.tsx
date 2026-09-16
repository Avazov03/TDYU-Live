import { AppShell } from "@/components/layout/AppShell";
import { EmptyGuide } from "@/components/cabinet/EmptyGuide";
import { LiveShortsFeed } from "@/components/shorts/LiveShortsFeed";
import { prisma } from "@/lib/prisma";
import { getActiveSubscriptions, requireAppUser } from "@/lib/access";
import { canWatchLive } from "@/lib/tariffs";
import { isStudentRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function ShortsPage() {
  const { user, sub } = await requireAppUser("/shorts");
  const student = isStudentRole(user.role);

  if (student && (!sub || !canWatchLive(sub.tier))) {
    return (
      <AppShell active="home">
        <div className="lx-board">
          <p className="lx-kicker">Shorts</p>
          <h2>Jonli efir ochiq emas</h2>
          <EmptyGuide
            title="2 va 3-tarif kerak"
            text="Jonli efir Shorts orqali faqat yuqori tariflarda ochiladi."
            href="/#tariflar"
            cta="Tarifni tanlash"
          />
        </div>
      </AppShell>
    );
  }

  const courseFilter = student
    ? { id: { in: (await getActiveSubscriptions(user.id)).map((s) => s.course.id) } }
    : { isPublished: true };

  const lives = await prisma.lesson.findMany({
    where: {
      status: "live",
      course: courseFilter,
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
        <div className="lx-board">
          <p className="lx-kicker">Shorts</p>
          <h2>Hozir jonli efir yo‘q</h2>
          <EmptyGuide
            title="Kutish kerak"
            text="O‘qituvchi efirni boshlagach shu yerda ochiladi. Shu orada rejani ko‘ring."
            href="/schedule"
            cta="Dars rejaga"
          />
        </div>
      ) : (
        <LiveShortsFeed shorts={items} />
      )}
    </AppShell>
  );
}
