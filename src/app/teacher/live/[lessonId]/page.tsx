import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { LiveStudio } from "@/components/teacher/LiveStudio";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { statusLabel, type PlanStatus } from "@/lib/plan";

export const dynamic = "force-dynamic";

export default async function TeacherLiveLessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/teacher/live/${lessonId}`);
  if (session.user.role !== "teacher") redirect("/");

  const teacher = await prisma.teacher.findUnique({
    where: { userId: session.user.id },
    select: { id: true, fullName: true },
  });
  if (!teacher) redirect("/teacher");

  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, course: { teacherId: teacher.id } },
    include: {
      course: {
        select: {
          id: true,
          titleUz: true,
          lessons: {
            where: { status: { in: ["scheduled", "lobby", "live"] } },
            orderBy: { scheduledAt: "asc" },
            select: { id: true, titleUz: true, status: true, scheduledAt: true },
          },
        },
      },
    },
  });
  if (!lesson) notFound();

  const siblings = lesson.course.lessons;

  return (
    <AppShell active="teacher">
      <div className="lx-board" style={{ marginBottom: 14 }}>
        <p className="lx-kicker">Efir sessiyasi</p>
        <nav className="studio-crumb" aria-label="Navigatsiya">
          <Link href="/teacher">Studio</Link>
          <span aria-hidden>/</span>
          <Link href="/teacher/reja">{lesson.course.titleUz}</Link>
          <span aria-hidden>/</span>
          <span>{lesson.titleUz}</span>
        </nav>
        <h2 style={{ marginTop: 8 }}>{lesson.titleUz}</h2>
        <p className="muted small lx-lead" style={{ marginBottom: 10 }}>
          <strong>{lesson.course.titleUz}</strong>
          {" · "}
          {formatDateTime(lesson.scheduledAt)}
          {" · "}
          <span className={`badge ${lesson.status === "live" ? "danger" : lesson.status === "lobby" ? "accent" : "pending"}`}>
            {statusLabel(lesson.status as PlanStatus)}
          </span>
        </p>
        <p className="small muted" style={{ margin: 0 }}>
          Shu dars uchun kutish xonasi va jonli efir. Boshqa kursga o‘tish uchun Studio yoki Rejaga qayting.
        </p>
      </div>

      {siblings.length > 1 ? (
        <div className="studio-lesson-switch lx-board" style={{ marginBottom: 14 }}>
          <p className="lx-kicker">Shu kursdagi boshqa dars</p>
          <div className="row gap-8" style={{ flexWrap: "wrap" }}>
            {siblings.map((s) => (
              <Link
                key={s.id}
                href={`/teacher/live/${s.id}`}
                className={`btn btn-sm${s.id === lesson.id ? " btn-primary" : ""}`}
              >
                {s.titleUz}
                {s.status === "live" ? " · Jonli" : s.status === "lobby" ? " · Kutish" : ""}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <LiveStudio
        lessonId={lesson.id}
        titleUz={lesson.titleUz}
        courseTitle={lesson.course.titleUz}
        whenLabel={formatDateTime(lesson.scheduledAt)}
        status={lesson.status}
        streamKey={lesson.streamKey}
        displayName={teacher.fullName}
      />

      <p style={{ marginTop: 16 }}>
        <Link href="/teacher" className="btn btn-sm">
          ← Studio (kurslar)
        </Link>{" "}
        <Link href="/teacher/reja" className="btn btn-sm">
          Reja jadvali
        </Link>
      </p>
    </AppShell>
  );
}
