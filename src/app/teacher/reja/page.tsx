import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyGuide } from "@/components/cabinet/EmptyGuide";
import { SoftDisclosure } from "@/components/admin/SoftDisclosure";
import { CreateLessonForm } from "@/components/teacher/CreateLessonForm";
import { CreateCoursePlanForm } from "@/components/teacher/CreateCoursePlanForm";
import { TeacherRejaBoard } from "@/components/teacher/TeacherRejaBoard";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureTeacherWorkspace } from "@/lib/teacher-workspace";

export const dynamic = "force-dynamic";

export default async function TeacherRejaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/teacher/reja");
  if (session.user.role !== "teacher") redirect("/");

  const row = await prisma.teacher.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!row) redirect("/teacher");

  await ensureTeacherWorkspace(row.id);
  const teacher = await prisma.teacher.findUnique({
    where: { id: row.id },
    include: { courses: { select: { id: true, titleUz: true } } },
  });
  if (!teacher) redirect("/teacher");

  const lessons = await prisma.lesson.findMany({
    where: { course: { teacherId: teacher.id } },
    include: { course: { select: { titleUz: true } } },
    orderBy: { scheduledAt: "asc" },
  });

  return (
    <AppShell active="teacher-reja">
      <div className="lx-board" style={{ marginBottom: 12 }}>
        <p className="lx-kicker">Reja</p>
        <h2>Dars rejasi</h2>
        <p className="muted small lx-lead">
          Kurs yarating yoki mavjud kursga dars qo‘shing. Jadval — sana, vaqt, holat, amallar.
        </p>
      </div>

      <SoftDisclosure title="Yangi kurs (umumiy mavzu)" defaultOpen={teacher.courses.length === 0}>
        <CreateCoursePlanForm />
      </SoftDisclosure>

      <SoftDisclosure title="Mavjud kursga dars qo‘shish" defaultOpen={lessons.length === 0 && teacher.courses.length > 0}>
        <CreateLessonForm courses={teacher.courses.map((c) => ({ id: c.id, titleUz: c.titleUz }))} />
      </SoftDisclosure>

      {lessons.length === 0 ? (
        <EmptyGuide
          title="Hali reja yo‘q"
          text="Yuqoridan kurs yoki dars qo‘shing — Studio’da kartalar chiqadi."
          href="/teacher"
          cta="Studio"
        />
      ) : (
        <TeacherRejaBoard
          lessons={lessons.map((lesson) => ({
            id: lesson.id,
            titleUz: lesson.titleUz,
            summaryUz: lesson.summaryUz,
            coverUrl: lesson.coverUrl,
            scheduledAt: lesson.scheduledAt.toISOString(),
            status: lesson.status,
            courseTitle: lesson.course.titleUz,
            recordingUrl: lesson.recordingUrl,
            playbackId: lesson.muxVodPlaybackId || lesson.muxLivePlaybackId,
            streamKey: lesson.streamKey,
          }))}
        />
      )}
    </AppShell>
  );
}
