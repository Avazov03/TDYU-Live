import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { CheckoutButton } from "@/components/course/CheckoutButton";
import { CheckoutV2Button } from "@/components/course/CheckoutV2Button";
import { Icon } from "@/components/ui/Icon";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  countOpenCourseSeats,
  getActiveSubscription,
  getOpenEnrollment,
  isStudentCourseOwned,
} from "@/lib/access";
import { featureFlags, getEnrollmentAccessMode, shouldHideStudentTariffUi } from "@/lib/feature-flags";
import {
  isCapacityAvailable,
  isCourseLifecyclePurchaseable,
  resolveServerListPrice,
} from "@/lib/checkout-v2/eligibility";
import { isStudentRole } from "@/lib/roles";
import { TARIFF_FEATURES, TARIFF_LABELS, TARIFF_SHORT, formatSom } from "@/lib/tariffs";
import { UZ_MONTHS_SHORT, formatDateTime, initials, tashkentParts } from "@/lib/utils";
import { hasPlayableRecording, statusLabel } from "@/lib/plan";
import type { LessonStatus, TariffTier } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const LIVE_STATUSES: LessonStatus[] = ["live", "lobby", "waiting_room", "paused"];
const DONE_STATUSES: LessonStatus[] = [
  "ended",
  "recording_processing",
  "recording_ready",
  "teacher_review",
  "published",
];

function dayMonth(date: Date) {
  const p = tashkentParts(date);
  return `${Number(p.day)}-${UZ_MONTHS_SHORT[p.monthIndex]}`;
}

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const course = await prisma.course.findUnique({
    where: { id, isPublished: true },
    include: {
      teacher: {
        include: {
          subject: true,
          _count: { select: { courses: { where: { isPublished: true } } } },
        },
      },
      faculty: true,
      subject: true,
      lessons: {
        orderBy: { scheduledAt: "asc" },
        include: { _count: { select: { assets: true } } },
      },
      _count: { select: { subscriptions: true } },
    },
  });
  if (!course) notFound();

  const sub = session?.user?.id
    ? await getActiveSubscription(session.user.id, course.id)
    : null;
  const enrollment = session?.user?.id
    ? await getOpenEnrollment(session.user.id, course.id)
    : null;

  const owned = isStudentCourseOwned({
    mode: getEnrollmentAccessMode(),
    hasOpenEnrollment: Boolean(enrollment),
    hasActiveSubscription: Boolean(sub),
  });
  const v2Enabled = featureFlags.courseCheckoutV2;
  const hideTariff = shouldHideStudentTariffUi();
  const listPrice = resolveServerListPrice(course.listPrice);
  const enrollmentMode = getEnrollmentAccessMode() === "enrollment";
  const openSeats = enrollmentMode || v2Enabled ? await countOpenCourseSeats(course.id) : 0;
  const seatsLeft = isCapacityAvailable(course.capacity, openSeats);
  const purchasable = isCourseLifecyclePurchaseable(course.lifecycleStatus, course.isPublished);
  const staffViewer = Boolean(session?.user) && !isStudentRole(session?.user?.role);

  const prices: { tier: TariffTier; price: number }[] = [
    { tier: "t1", price: course.priceT1 },
    { tier: "t2", price: course.priceT2 },
    { tier: "t3", price: course.priceT3 },
  ];

  const now = new Date();
  const lessons = course.lessons.filter((l) => l.status !== "cancelled");
  const doneCount = lessons.filter((l) => DONE_STATUSES.includes(l.status)).length;
  const liveLesson = lessons.find((l) => LIVE_STATUSES.includes(l.status));
  const nextLesson =
    liveLesson ?? lessons.find((l) => l.status === "scheduled" && l.scheduledAt >= now) ?? null;
  const startsAt = lessons[0]?.scheduledAt ?? course.startsAtApprox;
  const completed =
    enrollment?.status === "completed" || course.lifecycleStatus === "completed";
  const started =
    course.lifecycleStatus === "active" || lessons.some((l) => l.status !== "scheduled");
  const courseStatus = completed ? "Yakunlangan" : started ? "Davom etmoqda" : "Tez orada";
  const studentCount = enrollmentMode ? openSeats : course._count.subscriptions;
  const hasMaterials = lessons.some((l) => l._count.assets > 0);
  const lead = course.shortDescriptionUz?.trim() || course.descriptionUz;
  const showAbout = Boolean(course.shortDescriptionUz?.trim() && course.descriptionUz.trim());
  const enrollmentOwned = Boolean(enrollment && (!sub || enrollmentMode));
  const displayPrice = v2Enabled || hideTariff ? listPrice : null;
  const canBuyV2 = v2Enabled && listPrice != null && !staffViewer && purchasable && seatsLeft;

  return (
    <AppShell active={owned ? "my-courses" : "home"}>
      <div className="lx-cd">
        <Link href="/#kurslar" className="lx-cd-back">
          <Icon name="arrowLeft" size={16} /> Kurslar
        </Link>

        <header className="lx-cd-hero">
          <div className="lx-cd-chips">
            <span className="lx-cd-chip">{course.subject.nameUz}</span>
            <span className={`lx-cd-chip is-status${started && !completed ? " is-live" : ""}`}>
              {courseStatus}
            </span>
          </div>
          <h1 className="lx-cd-title">{course.titleUz}</h1>
          {lead ? <p className="lx-cd-lead">{lead}</p> : null}
          <ul className="lx-cd-meta">
            <li>
              <span className="avatar sm" aria-hidden>
                {initials(course.teacher.fullName)}
              </span>
              {course.teacher.fullName}
            </li>
            <li>
              <Icon name="book" size={16} /> {lessons.length} dars
            </li>
            {startsAt ? (
              <li>
                <Icon name="calendar" size={16} />
                {started ? "Boshlangan" : "Boshlanishi"}: {dayMonth(startsAt)}
              </li>
            ) : null}
            <li>
              <Icon name="clock" size={16} /> Har dars 60 daqiqagacha
            </li>
            {studentCount > 0 ? (
              <li>
                <Icon name="users" size={16} /> {studentCount} o‘quvchi
              </li>
            ) : null}
          </ul>
        </header>

        <div className="lx-cd-layout">
          <div className="lx-cd-main">
            {showAbout ? (
              <section className="lx-cd-block">
                <h2 className="lx-cd-h2">Kurs haqida</h2>
                <p className="lx-cd-text">{course.descriptionUz}</p>
              </section>
            ) : null}

            <section className="lx-cd-block">
              <div className="lx-cd-blockhead">
                <h2 className="lx-cd-h2">Dars rejasi</h2>
                {lessons.length > 0 ? (
                  <span className="lx-cd-count">
                    {owned ? `${doneCount} / ${lessons.length} o‘tildi` : `${lessons.length} dars`}
                  </span>
                ) : null}
              </div>
              {course.lessons.length === 0 ? (
                <p className="lx-cd-empty">
                  Dars rejasi hali e’lon qilinmagan. O‘qituvchi reja qo‘shgach shu yerda ko‘rinadi.
                </p>
              ) : (
                <ol className="lx-cd-lessons">
                  {course.lessons.map((lesson, i) => {
                    const p = tashkentParts(lesson.scheduledAt);
                    const cancelled = lesson.status === "cancelled";
                    const isLive = LIVE_STATUSES.includes(lesson.status);
                    const pill =
                      cancelled
                        ? "Bekor qilingan"
                        : lesson.status === "scheduled"
                          ? null
                          : statusLabel(lesson.status, {
                              hasRecording: hasPlayableRecording(
                                lesson.recordingUrl,
                                lesson.muxVodPlaybackId,
                              ),
                            });
                    const topic = lesson.topicUz?.trim() || lesson.summaryUz?.trim();
                    const body = (
                      <>
                        <span className="lx-cd-num">{String(i + 1).padStart(2, "0")}</span>
                        <span className="lx-cd-date">
                          <strong>{Number(p.day)}</strong>
                          <span>{UZ_MONTHS_SHORT[p.monthIndex]}</span>
                        </span>
                        <span className="lx-cd-linfo">
                          <span className="lx-cd-ltitle">{lesson.titleUz}</span>
                          <span className="lx-cd-lsub">
                            {p.hour}:{p.minute}
                            {topic ? ` · ${topic}` : ""}
                          </span>
                        </span>
                        <span className="lx-cd-lend">
                          {pill ? (
                            <span className={`lx-cd-pill${isLive ? " is-live" : ""}`}>{pill}</span>
                          ) : null}
                          {owned && !cancelled ? (
                            <span className="lx-cd-open" aria-hidden>
                              →
                            </span>
                          ) : !owned ? (
                            <span className="lx-cd-lock" title="Kursni sotib olgach ochiladi">
                              <Icon name="lock" size={16} />
                            </span>
                          ) : null}
                        </span>
                      </>
                    );
                    return (
                      <li key={lesson.id} className={cancelled ? "is-cancelled" : undefined}>
                        {owned && !cancelled ? (
                          <Link href={`/learn/${lesson.id}`} className="lx-cd-lesson is-link">
                            {body}
                          </Link>
                        ) : (
                          <div className="lx-cd-lesson">{body}</div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            <section className="lx-cd-block">
              <h2 className="lx-cd-h2">O‘qituvchi</h2>
              <div className="lx-cd-teacher">
                <span className="avatar lg" aria-hidden>
                  {initials(course.teacher.fullName)}
                </span>
                <div>
                  <p className="lx-cd-tname">{course.teacher.fullName}</p>
                  <p className="lx-cd-tsub">
                    {course.teacher.subject.nameUz} · {course.faculty.nameUz}
                  </p>
                  <p className="lx-cd-tsub">
                    {course.teacher._count.courses} ta e’lon qilingan kurs
                  </p>
                </div>
              </div>
            </section>
          </div>

          <aside className="lx-cd-aside" id="sotib-olish">
            {owned ? (
              <div className="lx-cd-buy" data-testid="course-owned">
                <p className="lx-cd-buy-kicker">{completed ? "Tarix" : "Sizning kursingiz"}</p>
                <p className="lx-cd-buy-title">
                  {enrollmentOwned
                    ? completed
                      ? "Kurs yakunlangan"
                      : "Kurs ochiq"
                    : sub
                      ? TARIFF_LABELS[sub.tier]
                      : "Kurs ochiq"}
                </p>
                {!enrollmentOwned && sub ? (
                  <p className="lx-cd-note">{formatDateTime(sub.endsAt)} gacha</p>
                ) : null}
                {lessons.length > 0 ? (
                  <div className="lx-cd-progress">
                    <div className="lx-cd-progress-row">
                      <span>Darslar</span>
                      <span>
                        {doneCount} / {lessons.length}
                      </span>
                    </div>
                    <div className="lx-cd-bar" aria-hidden>
                      <span style={{ width: `${Math.round((doneCount / lessons.length) * 100)}%` }} />
                    </div>
                  </div>
                ) : null}
                {nextLesson && !completed ? (
                  <>
                    <p className="lx-cd-next">
                      {liveLesson ? "Hozir efirda" : "Keyingi dars"}
                      <strong>{nextLesson.titleUz}</strong>
                      <span>{formatDateTime(nextLesson.scheduledAt)}</span>
                    </p>
                    <Link href={`/learn/${nextLesson.id}`} className="btn btn-primary lx-cd-cta">
                      {liveLesson ? "Darsga kirish" : "Darsni ochish"}
                    </Link>
                  </>
                ) : (
                  <Link href="/my-courses" className="btn btn-primary lx-cd-cta">
                    Mening kurslarim
                  </Link>
                )}
              </div>
            ) : v2Enabled && listPrice != null ? (
              <div className="lx-cd-buy" data-testid="course-checkout-v2">
                <p className="lx-cd-price">{formatSom(listPrice)}</p>
                <p className="lx-cd-note">Bir martalik to‘lov</p>
                {staffViewer ? (
                  <p className="lx-cd-state" data-testid="course-buy-staff">
                    O‘qituvchi va admin hisoblari kurs sotib olmaydi.
                  </p>
                ) : !purchasable ? (
                  <p className="lx-cd-state" data-testid="course-buy-closed">
                    Bu kurs hozir sotuvda emas.
                  </p>
                ) : !seatsLeft ? (
                  <p className="lx-cd-state is-warn" data-testid="course-capacity-full">
                    <strong>Joylar tugagan.</strong> Yangi o‘rin ochilsa, shu yerda sotib olish mumkin
                    bo‘ladi.
                  </p>
                ) : (
                  <CheckoutV2Button
                    courseId={course.id}
                    label={session?.user ? "Sotib olish" : "Kirib sotib olish"}
                    className="btn btn-primary lx-cd-cta"
                  />
                )}
                {course.capacity != null && seatsLeft && purchasable ? (
                  <p className="lx-cd-seats">
                    Qolgan joylar: <strong>{Math.max(course.capacity - openSeats, 0)}</strong> /{" "}
                    {course.capacity}
                  </p>
                ) : null}
                <IncludedList lessonCount={lessons.length} hasMaterials={hasMaterials} />
                <p className="lx-cd-fine">Demo to‘lov — haqiqiy pul yechilmaydi.</p>
              </div>
            ) : hideTariff ? (
              <div className="lx-cd-buy" data-testid="course-no-tariff">
                {displayPrice != null ? <p className="lx-cd-price">{formatSom(displayPrice)}</p> : null}
                <p className="lx-cd-state">Kurs xaridi tez orada ochiladi.</p>
                <Link href="/#kurslar" className="btn lx-cd-cta">
                  Boshqa kurslar
                </Link>
                <IncludedList lessonCount={lessons.length} hasMaterials={hasMaterials} />
              </div>
            ) : (
              <div className="lx-cd-buy">
                <p className="lx-cd-buy-kicker">Tarif tanlang</p>
                <p className="lx-cd-note">30 kunlik obuna. To‘lov sahifasida usulni tanlab, chek olasiz.</p>
                <div className="lx-cd-tiers">
                  {prices.map(({ tier, price }) => (
                    <div key={tier} className={`lx-cd-tier${tier === "t2" ? " is-rec" : ""}`}>
                      <p className="lx-cd-buy-kicker">{tier === "t2" ? "Tavsiya" : TARIFF_SHORT[tier]}</p>
                      <p className="lx-cd-tier-title">
                        {TARIFF_LABELS[tier]} · {formatSom(price)}
                      </p>
                      <ul className="lx-cd-included">
                        {TARIFF_FEATURES[tier].map((f) => (
                          <li key={f}>
                            <Icon name="check" size={14} /> {f}
                          </li>
                        ))}
                      </ul>
                      <CheckoutButton
                        courseId={course.id}
                        tier={tier}
                        label={session?.user ? "Tanlash" : "Kirib tanlash"}
                        className="btn btn-primary btn-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>

        {canBuyV2 && listPrice != null ? (
          <div className="lx-cd-mbar">
            <div>
              <strong>{formatSom(listPrice)}</strong>
              <span>Bir martalik to‘lov</span>
            </div>
            <a href="#sotib-olish" className="btn btn-primary">
              Sotib olish
            </a>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

function IncludedList({ lessonCount, hasMaterials }: { lessonCount: number; hasMaterials: boolean }) {
  return (
    <ul className="lx-cd-included">
      {lessonCount > 0 ? (
        <li>
          <Icon name="video" size={14} /> {lessonCount} ta jonli dars
        </li>
      ) : null}
      <li>
        <Icon name="play" size={14} /> Dars yozuvlari doimiy ochiq
      </li>
      {hasMaterials ? (
        <li>
          <Icon name="file" size={14} /> Dars materiallari
        </li>
      ) : null}
      <li>
        <Icon name="chat" size={14} /> Darsda o‘qituvchiga savol berish
      </li>
    </ul>
  );
}
