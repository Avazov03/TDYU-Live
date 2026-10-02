import type { CourseLifecycleStatus, LessonStatus, Prisma } from "@/generated/prisma/client";
import { getStudentOwnedCourses } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { listPublicCourses } from "@/lib/public-courses";
import { formatDateTime } from "@/lib/utils";
import type { GeminiFunctionDeclaration } from "@/lib/ai/gemini";
import type { AiRole } from "@/lib/ai/policy";

export type ToolContext = { userId: string | null; role: AiRole };

type Tool = {
  declaration: GeminiFunctionDeclaration;
  roles: AiRole[];
  run: (ctx: ToolContext, args: Record<string, unknown>) => Promise<unknown>;
};

const HELD: LessonStatus[] = ["ended", "recording_processing", "recording_ready", "teacher_review", "published"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PUBLIC_COURSE: Prisma.CourseWhereInput = {
  isPublished: true,
  OR: [{ lifecycleStatus: { in: ["published", "upcoming", "active"] } }, { lifecycleStatus: null }],
};

const COURSE_STATUS_UZ: Record<CourseLifecycleStatus, string> = {
  draft: "Qoralama",
  submitted: "Tekshiruvga yuborilgan",
  in_review: "Tekshiruvda",
  changes_requested: "Tuzatish so‘ralgan",
  rejected: "Rad etilgan",
  approved: "Tasdiqlangan",
  published: "E'lon qilingan",
  upcoming: "Tez orada boshlanadi",
  active: "Davom etmoqda",
  completed: "Yakunlangan",
  archived: "Arxivda",
  cancelled: "Bekor qilingan",
  unpublished: "Sotuvdan olingan",
};

const LESSON_STATUS_UZ: Record<LessonStatus, string> = {
  scheduled: "Rejalashtirilgan",
  lobby: "Kutish xonasi ochiq",
  waiting_room: "Kutish xonasi ochiq",
  live: "Jonli efirda",
  paused: "Tanaffusda",
  ended: "O‘tildi",
  recording_processing: "O‘tildi, yozuv tayyorlanmoqda",
  recording_ready: "O‘tildi, yozuv tekshiruvda",
  teacher_review: "O‘tildi, yozuv tekshiruvda",
  published: "O‘tildi, yozuv mavjud",
  cancelled: "Bekor qilingan",
};

function str(v: unknown, max = 120): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function when(d: Date | null | undefined): string | null {
  return d ? formatDateTime(d) : null;
}

async function ownedCourseIds(userId: string): Promise<string[]> {
  return (await getStudentOwnedCourses(userId)).map((c) => c.courseId);
}

const TOOLS: Record<string, Tool> = {
  search_courses: {
    roles: ["guest", "student", "teacher", "admin"],
    declaration: {
      name: "search_courses",
      description: "Saytdagi ochiq (sotuvdagi) kurslarni qidiradi: nom, fan, o‘qituvchi bo‘yicha. Bo‘sh so‘rov — eng yangi kurslar.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Qidiruv so‘zi (masalan: jinoyat huquqi)" } },
      },
    },
    run: async (_ctx, args) => {
      const page = await listPublicCourses({ query: str(args.query, 80), pageSize: 6 });
      return {
        total: page.total,
        courses: page.items.map((c) => ({
          title: c.title,
          teacher: c.teacherName,
          subject: c.subjectName,
          lessons: c.lessonCount,
          price_som: c.price,
          started: c.started,
          next_lesson: when(c.nextLessonAt),
          url: `/courses/${c.id}`,
        })),
      };
    },
  },

  list_teachers: {
    roles: ["guest", "student", "teacher", "admin"],
    declaration: {
      name: "list_teachers",
      description: "Saytda ochiq kursi bor o‘qituvchilar ro‘yxati va ularning fanlari. Ixtiyoriy: fan yoki ism bo‘yicha filtr.",
      parameters: { type: "object", properties: { query: { type: "string" } } },
    },
    run: async (_ctx, args) => {
      const q = str(args.query, 80);
      const teachers = await prisma.teacher.findMany({
        where: {
          courses: { some: PUBLIC_COURSE },
          ...(q.length >= 2
            ? {
                OR: [
                  { fullName: { contains: q, mode: "insensitive" } },
                  { subject: { nameUz: { contains: q, mode: "insensitive" } } },
                ],
              }
            : {}),
        },
        select: {
          fullName: true,
          subject: { select: { nameUz: true } },
          courses: { where: PUBLIC_COURSE, select: { id: true, titleUz: true }, take: 5 },
        },
        take: 15,
        orderBy: { fullName: "asc" },
      });
      return {
        teachers: teachers.map((t) => ({
          name: t.fullName,
          subject: t.subject.nameUz,
          courses: t.courses.map((c) => ({ title: c.titleUz, url: `/courses/${c.id}` })),
        })),
      };
    },
  },

  get_course_details: {
    roles: ["guest", "student", "teacher", "admin"],
    declaration: {
      name: "get_course_details",
      description: "Bitta kurs haqida: tavsif, o‘qituvchi, narx, darslar rejasi (mavzular va sanalar). Faqat ochiq yoki foydalanuvchining o‘z kursi.",
      parameters: { type: "object", properties: { courseId: { type: "string" } }, required: ["courseId"] },
    },
    run: async (ctx, args) => {
      const id = str(args.courseId, 40);
      if (!UUID_RE.test(id)) return { error: "Kurs topilmadi" };
      const owned = ctx.userId && ctx.role === "student" ? await ownedCourseIds(ctx.userId) : [];
      const course = await prisma.course.findFirst({
        where: { id, OR: [PUBLIC_COURSE, { id: { in: owned } }] },
        select: {
          id: true,
          titleUz: true,
          descriptionUz: true,
          listPrice: true,
          capacity: true,
          teacher: { select: { fullName: true } },
          subject: { select: { nameUz: true } },
          lessons: {
            where: { status: { not: "cancelled" } },
            orderBy: { scheduledAt: "asc" },
            select: { titleUz: true, topicUz: true, scheduledAt: true, status: true },
          },
        },
      });
      if (!course) return { error: "Kurs topilmadi yoki ochiq emas" };
      return {
        title: course.titleUz,
        description: course.descriptionUz.slice(0, 1200),
        teacher: course.teacher.fullName,
        subject: course.subject.nameUz,
        price_som: course.listPrice,
        owned_by_user: owned.includes(course.id),
        lessons: course.lessons.slice(0, 30).map((l) => ({
          title: l.titleUz,
          topic: l.topicUz,
          at: when(l.scheduledAt),
          held: HELD.includes(l.status),
        })),
        url: `/courses/${course.id}`,
      };
    },
  },

  get_my_courses: {
    roles: ["student"],
    declaration: {
      name: "get_my_courses",
      description: "Talabaning sotib olgan kurslari: holati, o‘tilgan/jami darslar, davomati, keyingi dars.",
    },
    run: async (ctx) => {
      const owned = await getStudentOwnedCourses(ctx.userId!);
      if (owned.length === 0) return { courses: [] };
      const now = new Date();
      const courses = await prisma.course.findMany({
        where: { id: { in: owned.map((o) => o.courseId) } },
        select: {
          id: true,
          titleUz: true,
          lifecycleStatus: true,
          teacher: { select: { fullName: true } },
          lessons: {
            where: { status: { not: "cancelled" } },
            orderBy: { scheduledAt: "asc" },
            select: {
              id: true,
              titleUz: true,
              scheduledAt: true,
              status: true,
              attendance: { where: { userId: ctx.userId! }, select: { id: true } },
            },
          },
        },
      });
      return {
        courses: courses.map((c) => {
          const held = c.lessons.filter((l) => HELD.includes(l.status));
          const next = c.lessons.find((l) => l.status === "scheduled" && l.scheduledAt >= now);
          return {
            title: c.titleUz,
            teacher: c.teacher.fullName,
            completed: c.lifecycleStatus === "completed",
            lessons_total: c.lessons.length,
            lessons_held: held.length,
            attended_live: held.filter((l) => l.attendance.length > 0).length,
            next_lesson: next ? { title: next.titleUz, at: when(next.scheduledAt), url: `/learn/${next.id}` } : null,
            url: `/courses/${c.id}`,
          };
        }),
      };
    },
  },

  get_my_schedule: {
    roles: ["student"],
    declaration: {
      name: "get_my_schedule",
      description: "Talabaning yaqin darslari (jonli efir vaqtlari).",
      parameters: { type: "object", properties: { days: { type: "integer", description: "Necha kun oldinga (1–30), default 14" } } },
    },
    run: async (ctx, args) => {
      const days = Math.min(30, Math.max(1, Number(args.days) || 14));
      const ids = await ownedCourseIds(ctx.userId!);
      const now = new Date();
      const lessons = await prisma.lesson.findMany({
        where: {
          courseId: { in: ids },
          status: { in: ["scheduled", "lobby", "waiting_room", "live", "paused"] },
          scheduledAt: { gte: new Date(now.getTime() - 2 * 3_600_000), lte: new Date(now.getTime() + days * 86_400_000) },
        },
        orderBy: { scheduledAt: "asc" },
        take: 20,
        select: { id: true, titleUz: true, scheduledAt: true, status: true, course: { select: { titleUz: true } } },
      });
      return {
        lessons: lessons.map((l) => ({
          course: l.course.titleUz,
          title: l.titleUz,
          at: when(l.scheduledAt),
          live_now: l.status === "live",
          url: `/learn/${l.id}`,
        })),
      };
    },
  },

  get_my_assignments: {
    roles: ["student"],
    declaration: {
      name: "get_my_assignments",
      description: "Talabaning topshiriqlari: muddati, topshirilganmi, baho va o‘qituvchi izohi.",
    },
    run: async (ctx) => {
      const ids = await ownedCourseIds(ctx.userId!);
      const rows = await prisma.assignment.findMany({
        where: { courseId: { in: ids } },
        orderBy: { dueAt: "asc" },
        take: 30,
        select: {
          titleUz: true,
          dueAt: true,
          course: { select: { titleUz: true } },
          submissions: { where: { userId: ctx.userId! }, select: { createdAt: true, grade: true, teacherNote: true } },
        },
      });
      const now = new Date();
      return {
        assignments: rows.map((a) => {
          const s = a.submissions[0];
          return {
            course: a.course.titleUz,
            title: a.titleUz,
            due: when(a.dueAt),
            overdue: !s && a.dueAt < now,
            submitted: Boolean(s),
            grade: s?.grade ?? null,
            teacher_note: s?.teacherNote?.slice(0, 300) ?? null,
          };
        }),
        url: "/assignments",
      };
    },
  },

  get_my_certificates: {
    roles: ["student"],
    declaration: { name: "get_my_certificates", description: "Talabaning amaldagi sertifikatlari." },
    run: async (ctx) => {
      const certs = await prisma.certificate.findMany({
        where: { userId: ctx.userId!, revokedAt: null },
        select: { id: true, issuedAt: true, course: { select: { titleUz: true } } },
        orderBy: { issuedAt: "desc" },
      });
      return { certificates: certs.map((c) => ({ course: c.course.titleUz, issued: when(c.issuedAt), url: `/certificates/${c.id}` })) };
    },
  },

  get_lesson_info: {
    roles: ["student", "teacher", "admin"],
    declaration: {
      name: "get_lesson_info",
      description: "Bitta dars: mavzu, qisqa tavsif, sana, holat, materiallar nomlari. Faqat foydalanuvchiga ruxsat berilgan dars.",
      parameters: { type: "object", properties: { lessonId: { type: "string" } }, required: ["lessonId"] },
    },
    run: async (ctx, args) => {
      const id = str(args.lessonId, 40);
      if (!UUID_RE.test(id) || !ctx.userId) return { error: "Dars topilmadi" };
      const lesson = await prisma.lesson.findUnique({
        where: { id },
        select: {
          id: true,
          titleUz: true,
          topicUz: true,
          summaryUz: true,
          scheduledAt: true,
          status: true,
          courseId: true,
          course: { select: { titleUz: true, teacher: { select: { fullName: true, userId: true } } } },
          assets: { select: { fileName: true }, take: 10 },
        },
      });
      if (!lesson) return { error: "Dars topilmadi" };
      const teacherOwns = ctx.role === "teacher" && lesson.course.teacher.userId === ctx.userId;
      if (ctx.role === "student") {
        if (!(await ownedCourseIds(ctx.userId)).includes(lesson.courseId)) {
          return { error: "Bu dars sizning kurslaringizda emas" };
        }
      } else if (ctx.role === "teacher" && !teacherOwns) {
        return { error: "Bu dars sizning kursingizda emas" };
      }
      return {
        course: lesson.course.titleUz,
        teacher: lesson.course.teacher.fullName,
        title: lesson.titleUz,
        topic: lesson.topicUz,
        summary: lesson.summaryUz?.slice(0, 1500) ?? null,
        at: when(lesson.scheduledAt),
        status: LESSON_STATUS_UZ[lesson.status],
        materials: lesson.assets.map((a) => a.fileName),
        url: `/learn/${lesson.id}`,
      };
    },
  },

  get_my_teaching_courses: {
    roles: ["teacher"],
    declaration: {
      name: "get_my_teaching_courses",
      description: "O‘qituvchining kurslari: holati, talabalar soni, o‘tilgan/jami darslar, o‘rtacha davomat, keyingi dars.",
    },
    run: async (ctx) => {
      const now = new Date();
      const courses = await prisma.course.findMany({
        where: { teacher: { userId: ctx.userId! } },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          titleUz: true,
          lifecycleStatus: true,
          enrollments: { where: { accessOpen: true, status: { in: ["active", "completed"] } }, select: { userId: true } },
          lessons: {
            where: { status: { not: "cancelled" } },
            orderBy: { scheduledAt: "asc" },
            select: { id: true, titleUz: true, scheduledAt: true, status: true, attendance: { select: { userId: true } } },
          },
        },
      });
      return {
        courses: courses.map((c) => {
          const students = new Set(c.enrollments.map((e) => e.userId));
          const held = c.lessons.filter((l) => HELD.includes(l.status));
          const seen = held.reduce((n, l) => n + l.attendance.filter((a) => students.has(a.userId)).length, 0);
          const next = c.lessons.find((l) => l.status === "scheduled" && l.scheduledAt >= now);
          return {
            title: c.titleUz,
            status: c.lifecycleStatus ? COURSE_STATUS_UZ[c.lifecycleStatus] : "Faol",
            students: students.size,
            lessons_total: c.lessons.length,
            lessons_held: held.length,
            avg_attendance_pct: students.size && held.length ? Math.round((seen / (students.size * held.length)) * 100) : null,
            next_lesson: next ? { title: next.titleUz, at: when(next.scheduledAt), url: `/learn/${next.id}` } : null,
          };
        }),
        group_url: "/teacher/group",
      };
    },
  },
};

export function toolsForRole(role: AiRole): GeminiFunctionDeclaration[] {
  return Object.values(TOOLS)
    .filter((t) => t.roles.includes(role))
    .map((t) => t.declaration);
}

/** Role is re-checked here: a model asking for a tool outside its role gets an error, never data. */
export async function runTool(ctx: ToolContext, name: string, args: Record<string, unknown> | undefined) {
  const tool = TOOLS[name];
  if (!tool || !tool.roles.includes(ctx.role)) return { error: "Bu amal mavjud emas" };
  if (ctx.role !== "guest" && !ctx.userId) return { error: "Kirish kerak" };
  try {
    return await tool.run(ctx, args ?? {});
  } catch (err) {
    console.error("ai_tool_failed", name, err instanceof Error ? err.message : err);
    return { error: "Ma'lumotni olishda xatolik" };
  }
}

export const AI_TOOL_NAMES = Object.keys(TOOLS);
export function toolRoles(name: string): AiRole[] {
  return TOOLS[name]?.roles ?? [];
}
