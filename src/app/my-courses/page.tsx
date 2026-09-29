import { AppShell } from "@/components/layout/AppShell";
import {
  MyCoursesBoard,
  type MyCourseItem,
  type MyNextLesson,
} from "@/components/cabinet/MyCoursesBoard";
import { getStudentOwnedCourses, requireStudentCabinet } from "@/lib/access";
import { shouldHideStudentTariffUi } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";
import { clockLabel, dayTitle } from "@/lib/plan";
import { TARIFF_LABELS } from "@/lib/tariffs";
import type { LessonStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const LIVE_STATUSES: LessonStatus[] = ["live", "lobby", "waiting_room", "paused"];
const DONE_STATUSES: LessonStatus[] = [
  "ended",
  "recording_processing",
  "recording_ready",
  "teacher_review",
  "published",
];
/** A scheduled lesson whose start passed less than this long ago is still "next". */
const NEXT_GRACE_MS = 60 * 60 * 1000;

export default async function MyCoursesPage() {
  const { user } = await requireStudentCabinet("/my-courses");
  const owned = await getStudentOwnedCourses(user.id);
  const courseIds = owned.map((o) => o.courseId);
  const hideTariffUi = shouldHideStudentTariffUi();

  const lessons =
    courseIds.length === 0
      ? []
      : await prisma.lesson.findMany({
          where: { courseId: { in: courseIds }, status: { not: "cancelled" } },
          orderBy: { scheduledAt: "asc" },
          select: { id: true, courseId: true, titleUz: true, scheduledAt: true, status: true },
        });

  const byCourse = new Map<string, typeof lessons>();
  for (const lesson of lessons) {
    const list = byCourse.get(lesson.courseId) ?? [];
    list.push(lesson);
    byCourse.set(lesson.courseId, list);
  }

  const now = new Date();
  const threshold = new Date(now.getTime() - NEXT_GRACE_MS);
  const candidates: { lesson: MyNextLesson; at: Date }[] = [];

  const items: MyCourseItem[] = owned.map((row) => {
    const list = byCourse.get(row.courseId) ?? [];
    const completed = row.status === "completed" || row.course.lifecycleStatus === "completed";
    const liveLesson = list.find((l) => LIVE_STATUSES.includes(l.status));
    const next =
      liveLesson ?? list.find((l) => l.status === "scheduled" && l.scheduledAt >= threshold);
    const live = Boolean(liveLesson) && !completed;

    if (next && !completed) {
      candidates.push({
        lesson: {
          lessonId: next.id,
          lessonTitle: next.titleUz,
          courseTitle: row.course.titleUz,
          when: `${dayTitle(next.scheduledAt)} · ${clockLabel(next.scheduledAt)}`,
          live,
        },
        at: next.scheduledAt,
      });
    }

    return {
      id: row.enrollmentId ?? `legacy-${row.courseId}`,
      courseId: row.courseId,
      title: row.course.titleUz,
      subject: row.course.subject.nameUz,
      teacherId: row.course.teacher.id,
      teacherName: row.course.teacher.fullName,
      active: !completed,
      live,
      badge: completed ? "Yakunlangan" : hideTariffUi ? "Faol" : TARIFF_LABELS[row.tier],
      done: list.filter((l) => DONE_STATUSES.includes(l.status)).length,
      total: list.length,
      nextText: completed
        ? "Yozuvlar doimiy ochiq"
        : next
          ? `${live ? "Hozir efirda" : "Keyingi dars"}: ${dayTitle(next.scheduledAt)} · ${clockLabel(next.scheduledAt)}`
          : "Keyingi dars hali belgilanmagan",
    };
  });

  candidates.sort(
    (a, b) => Number(b.lesson.live) - Number(a.lesson.live) || a.at.getTime() - b.at.getTime(),
  );
  const nextLesson = candidates[0]?.lesson ?? null;

  return (
    <AppShell active="my-courses">
      <MyCoursesBoard items={items} nextLesson={nextLesson} hideTariffUi={hideTariffUi} />
    </AppShell>
  );
}
