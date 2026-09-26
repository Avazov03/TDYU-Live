import { AppShell } from "@/components/layout/AppShell";
import { EmptyGuide } from "@/components/cabinet/EmptyGuide";
import { LiveShortsFeed, type LiveShort } from "@/components/shorts/LiveShortsFeed";
import { prisma } from "@/lib/prisma";
import {
  getAnyOpenEnrollment,
  getStudentOwnedCourseIds,
  requireAppUser,
} from "@/lib/access";
import { getEnrollmentAccessMode, isLiveMuxPlaybackV1Enabled } from "@/lib/feature-flags";
import {
  authorizeLiveMuxPlayback,
  getLiveMuxStatus,
  resolveLivePlaybackSource,
} from "@/lib/live-mux-playback";
import { muxPlayerUrl } from "@/lib/mux-player";
import { canWatchLive } from "@/lib/tariffs";
import { isStudentRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

/**
 * Shorts = live lesson feed scoped to owned courses (Wave 2).
 * Not an independent content catalog — membership uses the same ownership SoT
 * as /app /schedule (Enrollment-first when mode=enrollment).
 */
export default async function ShortsPage() {
  const { user, sub } = await requireAppUser("/shorts");
  const student = isStudentRole(user.role);
  const mode = getEnrollmentAccessMode();

  if (student) {
    const liveAllowed =
      mode === "enrollment"
        ? Boolean(await getAnyOpenEnrollment(user.id))
        : Boolean(sub && canWatchLive(sub.tier));
    if (!liveAllowed) {
      return (
        <AppShell active="home">
          <div className="lx-board">
            <p className="lx-kicker">Shorts</p>
            <h2>Jonli efir ochiq emas</h2>
            <EmptyGuide
              title={mode === "enrollment" ? "Kursga yozilish kerak" : "2 va 3-tarif kerak"}
              text={
                mode === "enrollment"
                  ? "Jonli efir Shorts faqat ochiq Enrollment bo‘lgan kurslar uchun."
                  : "Jonli efir Shorts orqali faqat yuqori tariflarda ochiladi."
              }
              href={mode === "enrollment" ? "/my-courses" : "/#tariflar"}
              cta={mode === "enrollment" ? "Kurslarim" : "Tarifni tanlash"}
            />
          </div>
        </AppShell>
      );
    }
  }

  const courseFilter = student
    ? { id: { in: await getStudentOwnedCourseIds(user.id) } }
    : { isPublished: true };

  const lives = await prisma.lesson.findMany({
    where: {
      status: "live",
      course: courseFilter,
    },
    include: { course: { include: { teacher: { select: { id: true, fullName: true } } } } },
    orderBy: { scheduledAt: "desc" },
  });

  const liveMuxV1 = isLiveMuxPlaybackV1Enabled();
  const items: LiveShort[] = [];
  for (const l of lives) {
    let playerUrl: string | null = null;
    if (liveMuxV1) {
      const decision = await authorizeLiveMuxPlayback({
        userId: user.id,
        role: user.role,
        lessonId: l.id,
      });
      if (!decision.ok) continue;
      const { status } = await getLiveMuxStatus(decision.liveStreamId, l.id);
      if (status === "active") playerUrl = resolveLivePlaybackSource(decision.playbackId).playerUrl;
    } else if (l.muxLivePlaybackId && !l.muxLivePlaybackId.startsWith("demo_")) {
      playerUrl = muxPlayerUrl(l.muxLivePlaybackId);
    }
    items.push({
      id: l.id,
      titleUz: l.titleUz,
      teacherName: l.course.teacher.fullName,
      teacherId: l.course.teacher.id,
      playerUrl,
      viewHint: l.course.titleUz,
    });
  }

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
