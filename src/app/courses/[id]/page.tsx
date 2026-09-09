import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { CheckoutButton } from "@/components/course/CheckoutButton";
import { CourseChannel } from "@/components/course/CourseChannel";
import { LessonRow } from "@/components/lesson/LessonRow";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveSubscription } from "@/lib/access";
import { TARIFF_FEATURES, TARIFF_LABELS, formatSom } from "@/lib/tariffs";
import { formatDateTime } from "@/lib/utils";
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

  const prices: { tier: TariffTier; price: number }[] = [
    { tier: "t1", price: course.priceT1 },
    { tier: "t2", price: course.priceT2 },
    { tier: "t3", price: course.priceT3 },
  ];

  const tariffs = sub ? (
    <div className="card" style={{ marginBottom: 8, maxWidth: 420 }}>
      <span className="badge success">{TARIFF_LABELS[sub.tier]} faol</span>
      <p className="small muted" style={{ marginTop: 8 }}>
        Muddat: {formatDateTime(sub.endsAt)} gacha
      </p>
      <Link href="/app" className="btn btn-primary" style={{ marginTop: 10 }}>
        Darslarga o&apos;tish
      </Link>
    </div>
  ) : (
    <div className="tariff-grid">
      {prices.map(({ tier, price }) => (
        <div key={tier} className={`card tariff-card${tier === "t2" ? " featured" : ""}`}>
          {tier === "t2" ? <span className="badge accent">Tavsiya</span> : null}
          <h3>{TARIFF_LABELS[tier]}</h3>
          <div className="num" style={{ fontSize: 22, margin: "8px 0" }}>{formatSom(price)}</div>
          <div className="small muted" style={{ marginBottom: 10 }}>30 kunlik demo to&apos;lov</div>
          <ul className="muted small" style={{ margin: "0 0 14px 16px", listStyle: "disc" }}>
            {TARIFF_FEATURES[tier].map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <CheckoutButton
            courseId={course.id}
            tier={tier}
            label={session?.user ? "Obuna bo'lish" : "Kirib obuna"}
          />
        </div>
      ))}
    </div>
  );

  const lessons = course.lessons.length === 0 ? (
    <div className="empty">Hali dars qo&apos;yilmagan.</div>
  ) : (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {course.lessons.map((lesson) => (
        <LessonRow
          key={lesson.id}
          id={lesson.id}
          titleUz={lesson.titleUz}
          subtitle={`${course.teacher.fullName} · ${formatDateTime(lesson.scheduledAt)}`}
          status={lesson.status}
        />
      ))}
    </div>
  );

  return (
    <AppShell active="catalog">
      <CourseChannel
        titleUz={course.titleUz}
        descriptionUz={course.descriptionUz}
        teacherName={course.teacher.fullName}
        facultyName={course.faculty.nameUz}
        subjectName={course.subject.nameUz}
        subscriberCount={course._count.subscriptions}
        subscribed={Boolean(sub)}
        lessons={lessons}
        tariffs={tariffs}
        initial={sub ? "lessons" : "tariffs"}
      />
    </AppShell>
  );
}
