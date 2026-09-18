import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { LiveChat } from "@/components/lesson/LiveChat";
import { LessonRow } from "@/components/lesson/LessonRow";
import { WatchShareButton } from "@/components/video/WatchShareButton";
import { MeetRoom } from "@/components/live/MeetRoom";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { accessMessage, getLessonAccess } from "@/lib/access";
import { canUseLiveChat } from "@/lib/tariffs";
import { muxPlayerUrl } from "@/lib/mux-player";
import { formatDateTime, initials } from "@/lib/utils";
import { isAdminRole, isTeacherRole } from "@/lib/roles";
import { hasPlayableRecording, statusLabel } from "@/lib/plan";

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
          lessons: {
            orderBy: { scheduledAt: "asc" },
            select: {
              id: true,
              titleUz: true,
              status: true,
              scheduledAt: true,
              recordingUrl: true,
              muxVodPlaybackId: true,
              muxLivePlaybackId: true,
            },
          },
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

  const staffJoin = Boolean(
    session?.user &&
      (isAdminRole(session.user.role) ||
        (isTeacherRole(session.user.role) && lesson.course.teacher.userId === session.user.id)),
  );
  const canJoinLive = lesson.status === "live" && (access.ok || staffJoin);
  const canWatchVod = access.ok || staffJoin;
  const displayName = session?.user?.name?.trim() || (staffJoin ? lesson.course.teacher.fullName : "Talaba");

  const playbackId =
    lesson.status === "live"
      ? lesson.muxLivePlaybackId
      : lesson.muxVodPlaybackId || lesson.muxLivePlaybackId;

  const readyNow = hasPlayableRecording(lesson.recordingUrl, playbackId);
  const playlist = lesson.course.lessons;
  const index = playlist.findIndex((item) => item.id === lesson.id);
  const prev = index > 0 ? playlist[index - 1] : null;
  const next = index >= 0 && index < playlist.length - 1 ? playlist[index + 1] : null;
  const doneCount = playlist.filter(
    (item) =>
      item.status === "ended" &&
      hasPlayableRecording(item.recordingUrl, item.muxVodPlaybackId || item.muxLivePlaybackId),
  ).length;
  const progressPct = playlist.length ? Math.round((doneCount / playlist.length) * 100) : 0;

  return (
    <AppShell active="my-courses">
      <div className="watch-layout">
        <div className="watch-main">
          {canJoinLive ? (
            <MeetRoom
              lessonId={lesson.id}
              displayName={displayName}
              subject={lesson.titleUz}
              moderator={staffJoin}
            />
          ) : canWatchVod && lesson.recordingUrl ? (
            <div className="player-wrap">
              <video
                src={`/api/media/recording/${lesson.id}`}
                controls
                playsInline
                preload="metadata"
                title={lesson.titleUz}
              />
            </div>
          ) : canWatchVod && playbackId && !playbackId.startsWith("demo_") ? (
            <div className="player-wrap">
              <iframe
                src={muxPlayerUrl(playbackId)}
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                title={lesson.titleUz}
              />
            </div>
          ) : canWatchVod && (lesson.status === "ended" || lesson.status === "live") ? (
            <div className="player-wrap">
              <div className={`player-demo course-thumb tone-${(lesson.id.charCodeAt(0) % 6) + 1}`}>
                <div>
                  <div className="badge pending" style={{ marginBottom: 8 }}>
                    {lesson.status === "live" ? "JONLI EFIR" : "YOZUV KUTILMOQDA"}
                  </div>
                  <h3>{lesson.titleUz}</h3>
                  <p className="muted small">
                    {lesson.status === "live"
                      ? "Jonli darsga kirish uchun ruxsat kerak."
                      : "Video hali yozilmagan — yozuv chiqgach shu yerda ochiladi."}
                  </p>
                </div>
              </div>
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
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 10 }}>
            <div className="muted small">
              {formatDateTime(lesson.scheduledAt)}
              {" · "}
              {statusLabel(lesson.status, { hasRecording: readyNow })}
            </div>
            <div className="row gap-8">
              <WatchShareButton path={`/learn/${lesson.id}`} />
            </div>
          </div>

          <div className="lx-learn-progress" aria-label="Kurs progressi">
            <div className="lx-learn-progress-meta">
              <span>
                {index >= 0 ? index + 1 : "—"}/{playlist.length} dars
              </span>
              <span>{progressPct}% yozuv tayyor</span>
            </div>
            <div className="lx-learn-progress-track">
              <div className="lx-learn-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          <div className="lx-learn-nav">
            {prev ? (
              <Link href={`/learn/${prev.id}`} className="btn btn-sm">
                ← {prev.titleUz}
              </Link>
            ) : (
              <span className="btn btn-sm" style={{ opacity: 0.4, pointerEvents: "none" }}>
                ← Oldingi
              </span>
            )}
            {next ? (
              <Link href={`/learn/${next.id}`} className="btn btn-primary btn-sm">
                {next.titleUz} →
              </Link>
            ) : (
              <Link href={`/courses/${lesson.course.id}`} className="btn btn-sm">
                Kursga qaytish
              </Link>
            )}
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

          {lesson.status === "ended" ? (
            <LiveChat
              lessonId={lesson.id}
              canSend={(access.ok && canUseLiveChat(access.tier)) || staffJoin}
            />
          ) : null}
        </div>

        <aside className="watch-sidebar">
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Keyingi darslar</h3>
          {playlist.map((item) => (
            <LessonRow
              key={item.id}
              id={item.id}
              titleUz={item.titleUz}
              subtitle={formatDateTime(item.scheduledAt)}
              status={item.status}
              compact
              active={item.id === lesson.id}
              recordingUrl={item.recordingUrl}
              playbackId={item.muxVodPlaybackId || item.muxLivePlaybackId}
            />
          ))}
        </aside>
      </div>
    </AppShell>
  );
}
