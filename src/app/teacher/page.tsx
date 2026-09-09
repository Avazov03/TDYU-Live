import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { CreateLessonForm } from "@/components/teacher/CreateLessonForm";
import { LiveStudio } from "@/components/teacher/LiveStudio";
import { LessonActions } from "@/components/teacher/LessonActions";
import { LessonRow } from "@/components/lesson/LessonRow";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TeacherHomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/teacher");
  if (session.user.role !== "teacher") redirect("/");

  const teacher = await prisma.teacher.findUnique({
    where: { userId: session.user.id },
    include: {
      courses: {
        include: { lessons: { orderBy: { scheduledAt: "desc" } } },
      },
    },
  });

  if (!teacher) {
    return (
      <AppShell active="teacher">
        <div className="empty">Profilingiz admin tomonidan hali bog&apos;lanmagan.</div>
      </AppShell>
    );
  }

  const lessons = teacher.courses.flatMap((c) =>
    c.lessons.map((l) => ({ ...l, courseTitle: c.titleUz })),
  );
  const live = lessons.find((l) => l.status === "live");
  const next = lessons.find((l) => l.status === "scheduled");
  const studio = live ?? next;
  const rest = lessons.filter((l) => l.id !== studio?.id);

  return (
    <AppShell active="teacher">
      <h2 style={{ marginBottom: 4 }}>O&apos;qituvchi kabineti</h2>
      <p className="muted small" style={{ marginBottom: 18 }}>{teacher.fullName}</p>

      {studio ? (
        <LiveStudio
          lessonId={studio.id}
          titleUz={studio.titleUz}
          courseTitle={studio.courseTitle}
          whenLabel={formatDateTime(studio.scheduledAt)}
          status={studio.status}
          streamKey={studio.streamKey}
        />
      ) : teacher.courses.length === 0 ? (
        <div className="empty">Kurs yo&apos;q. Admin sizga kurs biriktirishi kerak.</div>
      ) : (
        <div className="empty">Avval dars qo&apos;shing, keyin efirni shu yerdan boshlang.</div>
      )}

      <CreateLessonForm courses={teacher.courses.map((c) => ({ id: c.id, titleUz: c.titleUz }))} />

      {rest.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
          <h3 style={{ marginBottom: 4 }}>Boshqa darslar</h3>
          {rest.map((lesson) => (
            <LessonRow
              key={lesson.id}
              id={lesson.id}
              titleUz={lesson.titleUz}
              subtitle={`${lesson.courseTitle} · ${formatDateTime(lesson.scheduledAt)}`}
              status={lesson.status}
              actions={
                <LessonActions
                  lessonId={lesson.id}
                  status={lesson.status}
                  streamKey={lesson.streamKey}
                />
              }
            />
          ))}
        </div>
      ) : null}
    </AppShell>
  );
}
