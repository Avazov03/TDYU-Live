import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { CreateLessonForm } from "@/components/teacher/CreateLessonForm";
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

  return (
    <AppShell active="teacher">
      <h2 style={{ marginBottom: 8 }}>O&apos;qituvchi kabineti</h2>
      <p className="muted small" style={{ marginBottom: 16 }}>{teacher.fullName}</p>
      <CreateLessonForm courses={teacher.courses.map((c) => ({ id: c.id, titleUz: c.titleUz }))} />
      {lessons.length === 0 ? (
        <div className="empty">Hali dars yo&apos;q.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {lessons.map((lesson) => (
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
      )}
    </AppShell>
  );
}
