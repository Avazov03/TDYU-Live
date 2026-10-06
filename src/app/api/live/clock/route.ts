import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLessonAccess } from "@/lib/access";
import { beatTeachingClock } from "@/lib/live-clock-service";
import { claimLiveAccountLock, liveAccountLockStatus } from "@/lib/live-account-lock";
import { isAdminRole } from "@/lib/roles";
import { lessonCapture, setLessonCapture } from "@/lib/live-room-extras";
import { entityIdSchema } from "@/lib/entity-id";

const bodySchema = z.object({
  lessonId: entityIdSchema,
  instanceId: z.string().trim().min(8).max(80),
  claim: z.boolean().optional(),
  manualPause: z.boolean().optional(),
  capture: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Kirish kerak" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Noto‘g‘ri so‘rov" }, { status: 400 });
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: parsed.data.lessonId },
    include: { course: { select: { id: true, titleUz: true, teacher: { select: { userId: true } } } } },
  });
  if (!lesson) return NextResponse.json({ error: "Dars topilmadi" }, { status: 404 });

  const teacher =
    isAdminRole(session.user.role) || lesson.course.teacher.userId === session.user.id;
  if (!teacher) {
    if (parsed.data.manualPause !== undefined || parsed.data.capture !== undefined) {
      return NextResponse.json({ error: "Ruxsat yo‘q" }, { status: 403 });
    }
    const access = await getLessonAccess(session.user.id, lesson.course.id, lesson.status);
    if (!access.ok) return NextResponse.json({ error: "Ruxsat yo‘q" }, { status: 403 });
    if (parsed.data.claim) {
      await claimLiveAccountLock({
        userId: session.user.id,
        lessonId: lesson.id,
        instanceId: parsed.data.instanceId,
      });
    }
    const lock = await liveAccountLockStatus({
      userId: session.user.id,
      lessonId: lesson.id,
      instanceId: parsed.data.instanceId,
    });
    if (lock === "superseded") {
      return NextResponse.json({ superseded: true, error: "Boshqa qurilmada dars ochildi" });
    }
  } else if (parsed.data.capture !== undefined) {
    setLessonCapture(lesson.id, parsed.data.capture);
  }

  if (lesson.status !== "live" && lesson.status !== "paused") {
    return NextResponse.json({
      idle: true,
      status: lesson.status,
      capture: lessonCapture(lesson.id),
      courseTitle: lesson.course.titleUz,
    });
  }

  const clock = await beatTeachingClock({
    lessonId: lesson.id,
    actor: teacher ? "teacher" : "observer",
    manualPause: teacher ? parsed.data.manualPause : undefined,
  });

  return NextResponse.json({
    superseded: false,
    capture: lessonCapture(lesson.id),
    courseTitle: lesson.course.titleUz,
    clock,
  });
}
