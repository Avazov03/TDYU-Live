import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { LiveChat } from "@/components/lesson/LiveChat";
import { LessonRow } from "@/components/lesson/LessonRow";
import { ScheduledLessonCard } from "@/components/lesson/ScheduledLessonCard";
import { WatchShareButton } from "@/components/video/WatchShareButton";
import { MeetRoom } from "@/components/live/MeetRoom";
import { LiveMuxStage } from "@/components/live/LiveMuxStage";
import { RecordingPublishButton } from "@/components/teacher/RecordingPublishButton";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { accessMessage, getLessonAccess } from "@/lib/access";
import {
  shouldHideStudentTariffUi,
  getEnrollmentAccessMode,
  isLiveAttendanceV3Enabled,
  isLiveMuxPlaybackV1Enabled,
  isLiveWaitingRoomV2Enabled,
  isRecordingReviewV1Enabled,
  mustUseSecureMuxPlayback,
} from "@/lib/feature-flags";
import { isWaitingLessonStatus } from "@/lib/live-session";
import {
  authorizeLiveMuxPlayback,
  getLiveMuxStatus,
  resolveLivePlaybackSource,
} from "@/lib/live-mux-playback";
import { canUseLiveChat } from "@/lib/tariffs";
import { muxPlayerUrl } from "@/lib/mux-player";
import { UZ_MONTHS_SHORT, formatDateTime, initials, tashkentParts } from "@/lib/utils";
import { isAdminRole, isTeacherRole } from "@/lib/roles";
import {
  clockLabel,
  dayTitle,
  daysUntilLabel,
  hasPlayableRecording,
  isJoinableLiveStatus,
  statusLabel,
  weekdayUz,
} from "@/lib/plan";
import { Icon } from "@/components/ui/Icon";
import {
  getLatestRecordingForLesson,
  resolveReplayPlaybackId,
  studentMayPlayRecording,
  teacherMayPreviewRecording,
} from "@/lib/recording-lifecycle";
import { SecureMuxPlayer } from "@/components/video/SecureMuxPlayer";

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
            },
          },
        },
      },
    },
  });
  if (!lesson) notFound();

  const access = await getLessonAccess(session?.user?.id, lesson.courseId, lesson.status);
  const hideTariff = shouldHideStudentTariffUi();
  const liveV2 = isLiveWaitingRoomV2Enabled();
  const reviewV1 = isRecordingReviewV1Enabled();
  const forceSecureMux = mustUseSecureMuxPlayback();
  const waitingLike = isWaitingLessonStatus(lesson.status);
  const liveMuxV1 = isLiveMuxPlaybackV1Enabled();

  // Waiting-room presence is NOT attendance (Wave 1). Legacy path kept when flag off.
  // Mux path: watching the broadcast is not attendance — /api/live/join records it.
  const shouldMarkAttendance =
    access.ok &&
    !(liveMuxV1 && lesson.status === "live") &&
    Boolean(session?.user?.id) &&
    (liveV2
      ? lesson.status === "live" || lesson.status === "ended" || lesson.status === "published"
      : lesson.status === "live" || lesson.status === "lobby" || lesson.status === "ended");

  if (shouldMarkAttendance && session?.user?.id) {
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
  // The paywall preview is marketing for published courses only; drafts and withdrawn courses do not exist to outsiders.
  if (!access.ok && !staffJoin && !lesson.course.isPublished) notFound();
  const canJoinLive =
    (lesson.status === "live" || waitingLike) && (access.ok || staffJoin);
  const canWatchVod = access.ok || staffJoin;
  const liveMux =
    liveMuxV1 && lesson.status === "live"
      ? await authorizeLiveMuxPlayback({
          userId: session?.user?.id,
          role: session?.user?.role,
          lessonId: lesson.id,
        })
      : null;
  const liveMuxStatus = liveMux?.ok ? await getLiveMuxStatus(liveMux.liveStreamId, lesson.id) : null;
  const livePlayback =
    liveMux?.ok && liveMuxStatus?.status === "active"
      ? resolveLivePlaybackSource(liveMux.playbackId)
      : null;
  const displayName = session?.user?.name?.trim() || (staffJoin ? lesson.course.teacher.fullName : "Talaba");

  const recordingRow = reviewV1 ? await getLatestRecordingForLesson(lesson.id) : null;
  const recordingStatus = recordingRow?.status ?? null;

  const playbackId = resolveReplayPlaybackId({
    lessonStatus: lesson.status,
    recordingPlaybackId: recordingRow?.muxPlaybackId,
    lessonVodPlaybackId: lesson.muxVodPlaybackId,
  });

  const localRecordingUrl = recordingRow?.storageKey || lesson.recordingUrl;

  const studentMayPlay = reviewV1
    ? studentMayPlayRecording({ flagOn: true, recordingStatus })
    : true;
  const teacherMayPreview = reviewV1
    ? teacherMayPreviewRecording({ flagOn: true, recordingStatus })
    : true;

  const showLocalVideo =
    canWatchVod &&
    Boolean(localRecordingUrl) &&
    (staffJoin ? teacherMayPreview : studentMayPlay);
  const showMuxVod =
    canWatchVod &&
    Boolean(playbackId && !playbackId.startsWith("demo_")) &&
    lesson.status !== "live" &&
    (staffJoin ? teacherMayPreview : studentMayPlay);
  const showPendingReview =
    canWatchVod &&
    reviewV1 &&
    !staffJoin &&
    recordingRow &&
    !studentMayPlay &&
    recordingStatus !== "failed";

  const readyNow = reviewV1
    ? Boolean(recordingStatus === "published")
    : hasPlayableRecording(lesson.recordingUrl, playbackId);
  const playlist = lesson.course.lessons;
  const index = playlist.findIndex((item) => item.id === lesson.id);
  const prev = index > 0 ? playlist[index - 1] : null;
  const next = index >= 0 && index < playlist.length - 1 ? playlist[index + 1] : null;
  const doneCount = playlist.filter(
    (item) =>
      (item.status === "ended" || item.status === "published") &&
      hasPlayableRecording(item.recordingUrl, item.muxVodPlaybackId),
  ).length;
  const progressPct = playlist.length ? Math.round((doneCount / playlist.length) * 100) : 0;
  const courseNotStarted =
    playlist.length > 0 &&
    playlist.every((item) => item.status === "scheduled" || item.status === "cancelled");
  const firstLesson = playlist.find((item) => item.status === "scheduled") ?? playlist[0];
  const nextPlayable = Boolean(
    next &&
      (isJoinableLiveStatus(next.status) ||
        hasPlayableRecording(next.recordingUrl, next.muxVodPlaybackId)),
  );
  const isScheduled = lesson.status === "scheduled";
  const startParts = tashkentParts(lesson.scheduledAt);
  const lessonEnd =
    lesson.scheduledEndAt ??
    new Date(lesson.scheduledAt.getTime() + (lesson.durationMinutes ?? 90) * 60_000);
  const siteBase = (process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");

  return (
    <AppShell active="my-courses">
      <div className="watch-layout">
        <div className="watch-main">
          {liveMux?.ok ? (
            <LiveMuxStage
              lessonId={lesson.id}
              title={lesson.titleUz}
              initialStatus={liveMuxStatus?.status ?? "unknown"}
              initialPlayerUrl={livePlayback?.playerUrl ?? null}
              room={
                canJoinLive
                  ? { displayName, subject: lesson.titleUz, moderator: staffJoin }
                  : null
              }
              attendanceTracked={isLiveAttendanceV3Enabled()}
            />
          ) : canJoinLive ? (
            <MeetRoom
              lessonId={lesson.id}
              displayName={displayName}
              subject={lesson.titleUz}
              moderator={staffJoin}
              phase={lesson.status === "live" ? "live" : "lobby"}
            />
          ) : showLocalVideo ? (
            <div className="player-wrap">
              <video
                src={`/api/media/recording/${lesson.id}`}
                controls
                playsInline
                preload="metadata"
                title={lesson.titleUz}
                data-testid="recording-player"
              />
            </div>
          ) : showMuxVod && forceSecureMux ? (
            <SecureMuxPlayer
              lessonId={lesson.id}
              recordingId={recordingRow?.id}
              title={lesson.titleUz}
            />
          ) : showMuxVod && !forceSecureMux ? (
            <div className="player-wrap">
              <iframe
                src={muxPlayerUrl(playbackId!)}
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                title={lesson.titleUz}
                data-testid="recording-mux-player"
              />
            </div>
          ) : showPendingReview ? (
            <div className="player-wrap">
              <div className={`player-demo course-thumb tone-${(lesson.id.charCodeAt(0) % 6) + 1}`}>
                <div>
                  {recordingStatus === "processing" || recordingStatus === "not_started" ? (
                    <>
                      <div className="badge pending" style={{ marginBottom: 8 }} data-testid="recording-preparing">
                        YOZUV TAYYORLANMOQDA
                      </div>
                      <h3>{lesson.titleUz}</h3>
                      <p className="muted small">
                        Video qayta ishlanmoqda. Tayyor bo‘lgach o‘qituvchi ko‘rib chiqadi va shu yerda ochiladi.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="badge pending" style={{ marginBottom: 8 }} data-testid="recording-pending-review">
                        YOZUV TEKSHIRUVDA
                      </div>
                      <h3>{lesson.titleUz}</h3>
                      <p className="muted small">
                        Yozuv o‘qituvchi tekshiruvidan keyin ochiladi.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : canWatchVod && (lesson.status === "ended" || lesson.status === "live" || lesson.status === "recording_processing") ? (
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
          ) : lesson.status === "scheduled" &&
            (canWatchVod || (!access.ok && access.reason === "not_started")) ? (
            <ScheduledLessonCard
              lessonId={lesson.id}
              title={lesson.titleUz}
              courseTitle={lesson.course.titleUz}
              startsAtIso={lesson.scheduledAt.toISOString()}
              endsAtIso={lessonEnd.toISOString()}
              dayNum={String(Number(startParts.day))}
              monthShort={UZ_MONTHS_SHORT[startParts.monthIndex]}
              whenLabel={`${weekdayUz(lesson.scheduledAt)}, ${dayTitle(lesson.scheduledAt)} · ${clockLabel(lesson.scheduledAt)}`}
              relativeLabel={daysUntilLabel(lesson.scheduledAt)}
              lessonUrl={`${siteBase}/learn/${lesson.id}`}
            />
          ) : (
            <div className="player-wrap paywall">
              <div>
                <h3 style={{ marginBottom: 8 }}>{lesson.titleUz}</h3>
                <p className="muted">
                  {!access.ok ? accessMessage(access.reason) : "Video hali tayyor emas."}
                </p>
                {!access.ok && access.reason !== "unauthenticated" ? (
                  <Link
                    href={hideTariff ? "/search" : "/#tariflar"}
                    className="btn btn-primary"
                    style={{ marginTop: 12 }}
                  >
                    {hideTariff ? "Kurslarni ko‘rish" : "Tarifni oshirish"}
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
            {courseNotStarted && firstLesson ? (
              <div className="lx-learn-soon" aria-label="Kurs holati">
                <Icon name="calendar" size={16} />
                <span>
                  Kurs <b>{dayTitle(firstLesson.scheduledAt)}</b> boshlanadi · {playlist.length} ta dars
                  {index >= 0 ? ` · bu ${index + 1}-dars` : ""}
                </span>
              </div>
            ) : (
              <div className="muted small">
                {isScheduled ? null : (
                  <>
                    {formatDateTime(lesson.scheduledAt)}
                    {" · "}
                    {statusLabel(lesson.status, { hasRecording: readyNow })}
                  </>
                )}
              </div>
            )}
            <div className="row gap-8">
              <WatchShareButton path={`/learn/${lesson.id}`} />
            </div>
          </div>

          {staffJoin && reviewV1 && recordingStatus ? (
            <RecordingPublishButton lessonId={lesson.id} status={recordingStatus} />
          ) : null}

          {courseNotStarted ? null : (
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
          )}

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
              <Link href={`/learn/${next.id}`} className={nextPlayable ? "btn btn-primary btn-sm" : "btn btn-sm"}>
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
            <Link href={`/courses/${lesson.course.id}`} className={isScheduled ? "btn btn-sm" : "btn btn-primary btn-sm"}>
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
              canSend={
                (access.ok &&
                  (getEnrollmentAccessMode() === "enrollment" || canUseLiveChat(access.tier))) ||
                staffJoin
              }
            />
          ) : null}
        </div>

        <aside className="watch-sidebar">
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Kurs darslari</h3>
          {playlist.map((item) => (
            <LessonRow
              key={item.id}
              id={item.id}
              titleUz={item.titleUz}
              subtitle={`${dayTitle(item.scheduledAt)}, ${clockLabel(item.scheduledAt)}`}
              status={item.status}
              compact
              active={item.id === lesson.id}
              recordingUrl={item.recordingUrl}
              playbackId={item.muxVodPlaybackId}
            />
          ))}
        </aside>
      </div>
    </AppShell>
  );
}
