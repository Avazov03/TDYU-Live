import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { LiveChat } from "@/components/lesson/LiveChat";
import { LessonRow } from "@/components/lesson/LessonRow";
import { WatchShareButton } from "@/components/video/WatchShareButton";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { accessMessage, getLessonAccess } from "@/lib/access";
import { canUseLiveChat } from "@/lib/tariffs";
import { muxPlayerUrl } from "@/lib/mux-player";
import { formatDateTime, initials } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LearnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: {
      course: {
        include: {
          teacher: true,
          lessons: { orderBy: { scheduledAt: "asc" }, select: { id: true, titleUz: true, status: true, scheduledAt: true } },
        },
      },
    },
  });
  if (!lesson) notFound();

  const access = await getLessonAccess(session?.user?.id, lesson.courseId, lesson.status);

  if (access.ok && session?.user?.id && (lesson.status === "live" || lesson.status === "ended")) {
    await prisma.attendance.upsert({
      where: { userId_lessonId: { userId: session.user.id, lessonId: lesson.id } },
      update: {},
      create: { userId: session.user.id, lessonId: lesson.id },
    });
  }

  const playbackId =
    lesson.status === "live"
      ? lesson.muxLivePlaybackId
      : lesson.muxVodPlaybackId || lesson.muxLivePlaybackId;

  return (
    <AppShell active="my-courses">
      <div className="watch-layout">
        <div className="watch-main">
          {access.ok && playbackId ? (
            <div className="player-wrap">
              {playbackId.startsWith("demo_") ? (
                <div className={`player-demo course-thumb tone-${(lesson.id.charCodeAt(0) % 6) + 1}`}>
                  <div>
                    <div className="badge danger" style={{ marginBottom: 8 }}>
                      {lesson.status === "live" ? "JONLI EFIR" : "YOZUV"}
                    </div>
                    <h3>{lesson.titleUz}</h3>
                    <p className="muted small">Video hali yozilmagan.</p>
                  </div>
                </div>
              ) : (
                <iframe
                  src={muxPlayerUrl(playbackId)}
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                  title={lesson.titleUz}
                />
              )}
            </div>
          ) : (
            <div className="player-wrap paywall">
              <div>
                <h3 style={{ marginBottom: 8 }}>{lesson.titleUz}</h3>
                <p className="muted">
                  {!access.ok ? accessMessage(access.reason) : "Video hali tayyor emas."}
                </p>
                {!access.ok && access.reason !== "unauthenticated" ? (
                  <Link href="/#tariflar" className="btn btn-primary" style={{ marginTop: 12 }}>
                    Tarifni oshirish
                  </Link>
                ) : null}
                {!access.ok && access.reason === "unauthenticated" ? (
                  <Link href={`/login?callbackUrl=/learn/${lesson.id}`} className="btn btn-primary" style={{ marginTop: 12 }}>
                    Kirish
                  </Link>
                ) : null}
              </div>
            </div>
          )}

          <h2 style={{ margin: "16px 0 8px", fontSize: 18 }}>{lesson.titleUz}</h2>
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
            <div className="muted small">
              {formatDateTime(lesson.scheduledAt)}
              {lesson.status === "live" ? " · Jonli" : lesson.status === "ended" ? " · Yozuv" : " · Reja"}
            </div>
            <div className="row gap-8">
              <WatchShareButton path={`/learn/${lesson.id}`} />
            </div>
          </div>

          <div className="teacher-bar">
            <Link href={`/courses/${lesson.course.id}`} className="row gap-12 teacher-bar-link">
              <span className="avatar">{initials(lesson.course.teacher.fullName)}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{lesson.course.teacher.fullName}</div>
                <div className="small muted">{lesson.course.titleUz}</div>
              </div>
            </Link>
            <Link href={`/courses/${lesson.course.id}`} className="btn btn-primary btn-sm">
              Kurs
            </Link>
          </div>

          {lesson.course.descriptionUz ? (
            <p className="muted" style={{ margin: "0 0 18px", maxWidth: 720 }}>
              {lesson.course.descriptionUz}
            </p>
          ) : null}

          {lesson.status === "live" || lesson.status === "ended" ? (
            <LiveChat
              lessonId={lesson.id}
              canSend={access.ok && canUseLiveChat(access.tier)}
            />
          ) : null}
        </div>

        <aside className="watch-sidebar">
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Keyingi darslar</h3>
          {lesson.course.lessons.map((item) => (
            <LessonRow
              key={item.id}
              id={item.id}
              titleUz={item.titleUz}
              subtitle={formatDateTime(item.scheduledAt)}
              status={item.status}
              compact
              active={item.id === lesson.id}
            />
          ))}
        </aside>
      </div>
    </AppShell>
  );
}
