import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { CheckoutButton } from "@/components/course/CheckoutButton";
import { CheckoutV2Button } from "@/components/course/CheckoutV2Button";
import { EmptyGuide } from "@/components/cabinet/EmptyGuide";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getActiveSubscription,
  getOpenEnrollment,
  isStudentCourseOwned,
} from "@/lib/access";
import { featureFlags, getEnrollmentAccessMode } from "@/lib/feature-flags";
import { resolveServerListPrice } from "@/lib/checkout-v2/eligibility";
import { TARIFF_FEATURES, TARIFF_LABELS, TARIFF_SHORT, formatSom } from "@/lib/tariffs";
import { formatDateTime } from "@/lib/utils";
import { clockLabel, dayTitle, hasPlayableRecording, statusLabel } from "@/lib/plan";
import type { TariffTier } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const course = await prisma.course.findUnique({
    where: { id, isPublished: true },
    include: {
      teacher: true,
      faculty: true,
      subject: true,
      lessons: { orderBy: { scheduledAt: "asc" } },
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
  const listPrice = resolveServerListPrice(course.listPrice);

  const prices: { tier: TariffTier; price: number }[] = [
    { tier: "t1", price: course.priceT1 },
    { tier: "t2", price: course.priceT2 },
    { tier: "t3", price: course.priceT3 },
  ];

  return (
    <AppShell active={owned ? "my-courses" : "home"}>
      <div className="lx-board">
        <p className="lx-kicker">
          {course.faculty.nameUz} · {course.subject.nameUz}
        </p>
        <h2>{course.titleUz}</h2>
        <p className="muted small lx-lead">
          {course.teacher.fullName} · {course._count.subscriptions} obunachi
        </p>
        {course.descriptionUz ? (
          <p className="muted" style={{ marginTop: -8, maxWidth: 640 }}>
            {course.descriptionUz}
          </p>
        ) : null}

        {owned ? (
          <section className="lx-section" data-testid="course-owned">
            <h3>
              {enrollment && (!sub || getEnrollmentAccessMode() === "enrollment")
                ? "Sizning kursingiz"
                : "Sizning obunangiz"}
            </h3>
            <div className="lx-row">
              <div>
                <p className="lx-kicker">Faol</p>
                <h3>
                  {enrollment && (!sub || getEnrollmentAccessMode() === "enrollment")
                    ? enrollment.status === "completed"
                      ? "Enrollment · yakunlangan"
                      : "Enrollment"
                    : sub
                      ? TARIFF_LABELS[sub.tier]
                      : "Enrollment"}
                </h3>
                {enrollment && (!sub || getEnrollmentAccessMode() === "enrollment") ? (
                  <p className="small muted" style={{ margin: 0 }}>
                    Kursga yozilgansiz
                  </p>
                ) : sub ? (
                  <p className="small muted" style={{ margin: 0 }}>
                    {formatDateTime(sub.endsAt)} gacha
                  </p>
                ) : (
                  <p className="small muted" style={{ margin: 0 }}>
                    Kursga yozilgansiz
                  </p>
                )}
              </div>
              <Link href="/app" className="lx-go">
                Bugunga
              </Link>
            </div>
          </section>
        ) : v2Enabled && listPrice != null ? (
          <section className="lx-section" data-testid="course-checkout-v2">
            <h3>Kursni sotib olish</h3>
            <p className="muted small" style={{ margin: "0 0 12px" }}>
              Checkout V2 · {formatSom(listPrice)}. Demo to‘lov — haqiqiy pul yechilmaydi.
            </p>
            <CheckoutV2Button
              courseId={course.id}
              label={session?.user ? `Sotib olish · ${formatSom(listPrice)}` : "Kirib sotib olish"}
              className="btn btn-primary"
            />
          </section>
        ) : (
          <section className="lx-section">
            <h3>Tarif tanlang</h3>
            <p className="muted small" style={{ margin: "0 0 12px" }}>
              30 kunlik obuna. To‘lov sahifasida usulni tanlab, chek olasiz.
            </p>
            <div className="lx-stack">
              {prices.map(({ tier, price }) => (
                <div key={tier} className="lx-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="lx-kicker">
                      {tier === "t2" ? "Tavsiya" : TARIFF_SHORT[tier]}
                    </p>
                    <h3>
                      {TARIFF_LABELS[tier]} · {formatSom(price)}
                    </h3>
                    <ul className="muted small" style={{ margin: "8px 0 12px 16px", listStyle: "disc" }}>
                      {TARIFF_FEATURES[tier].map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                    <CheckoutButton
                      courseId={course.id}
                      tier={tier}
                      label={session?.user ? "Tanlash" : "Kirib tanlash"}
                      className="btn btn-primary btn-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="lx-section">
          <h3>Darslar</h3>
          {course.lessons.length === 0 ? (
            <EmptyGuide
              title="Hali dars qo‘yilmagan"
              text="O‘qituvchi reja qo‘shgach shu yerda ochiladi."
              href={owned ? "/schedule" : "/#tariflar"}
              cta={owned ? "Dars rejaga" : "Tariflarga"}
            />
          ) : (
            <div className="lx-stack">
              {course.lessons.map((lesson) => {
                const body = (
                  <>
                    <div>
                      <p className="lx-kicker">
                        {dayTitle(lesson.scheduledAt)} · {clockLabel(lesson.scheduledAt)}
                      </p>
                      <h3>{lesson.titleUz}</h3>
                      <p className="small muted" style={{ margin: 0 }}>
                        {statusLabel(lesson.status, {
                          hasRecording: hasPlayableRecording(
                            lesson.recordingUrl,
                            lesson.muxVodPlaybackId || lesson.muxLivePlaybackId,
                          ),
                        })}
                      </p>
                    </div>
                    {owned ? <span className="lx-go">Ochish</span> : null}
                  </>
                );
                return owned ? (
                  <Link key={lesson.id} href={`/learn/${lesson.id}`} className="lx-row">
                    {body}
                  </Link>
                ) : (
                  <div key={lesson.id} className="lx-row is-dim">
                    {body}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
