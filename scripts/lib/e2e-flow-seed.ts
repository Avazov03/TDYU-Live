/**
 * Hermetic-only fixtures for the mutating browser flows in e2e/flows (refund, course cancel,
 * assignments, course completion, certificates). Call on a freshly truncated database after
 * the shared fixtures exist (fixture teacher + faculty/subjects). IDs: FLOW_FIXTURES.
 */

import type { createSeedClient } from "../../src/lib/prisma";
import { hashPassword } from "../../src/lib/password";
import { FLOW_FIXTURES as F } from "../../e2e/helpers/test-data";
import { E2E_FIXTURE_TEACHER_ID } from "../../src/lib/e2e-fixture-reset";

type SeedClient = ReturnType<typeof createSeedClient>;

const DAY = 86_400_000;
const id = (suffix: string) => `f2700001-0000-4000-8000-0000000000${suffix}`;

export async function seedFlowFixtures(
  prisma: SeedClient,
  opts: { facultyId: string; subjectId: string; subject2Id: string; now?: number },
) {
  const now = opts.now ?? Date.now();
  const at = (days: number) => new Date(now + days * DAY);
  const passwordHash = await hashPassword(F.password);

  await prisma.user.createMany({
    data: Object.values(F.users).map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.name,
      passwordHash,
      role: u === F.users.teacher2 ? ("teacher" as const) : ("student" as const),
    })),
  });
  await prisma.teacher.create({
    data: {
      id: F.teacher2Id,
      userId: F.users.teacher2.id,
      facultyId: opts.facultyId,
      subjectId: opts.subject2Id,
      fullName: F.users.teacher2.name,
      contactEmail: F.users.teacher2.email,
    },
  });

  const course = (courseId: string, titleUz: string, lifecycleStatus: "active" | "upcoming" | "completed", listPrice = 200000) => ({
    id: courseId,
    teacherId: E2E_FIXTURE_TEACHER_ID,
    facultyId: opts.facultyId,
    subjectId: opts.subjectId,
    titleUz,
    descriptionUz: `E2E flow fixture: ${titleUz}.`,
    priceT1: listPrice,
    priceT2: listPrice,
    priceT3: listPrice,
    listPrice,
    isPublished: true,
    lifecycleStatus,
  });
  await prisma.course.createMany({
    data: [
      course(F.refund.courseId, F.refund.courseTitle, "active", F.refund.amountPaid),
      course(F.keep.courseId, F.keep.courseTitle, "active"),
      course(F.cancel.courseId, F.cancel.courseTitle, "upcoming", F.cancel.amountPaid),
      course(F.assignments.courseId, F.assignments.courseTitle, "active"),
      course(F.completion.courseId, F.completion.courseTitle, "active"),
      course(F.certificate.courseId, F.certificate.courseTitle, "completed"),
      { ...course(F.otherTeacherCourse.courseId, F.otherTeacherCourse.courseTitle, "active"), teacherId: F.teacher2Id },
    ],
  });

  const ended = (lessonId: string, courseId: string, titleUz: string, days: number) => ({
    id: lessonId,
    courseId,
    titleUz,
    scheduledAt: at(days),
    status: "ended" as const,
  });
  // Future lessons stay ≥ 7 days out: the live fixture reset rejects fixture-teacher lessons starting within 90 minutes.
  const scheduled = (lessonId: string, courseId: string, titleUz: string, days: number) => ({
    id: lessonId,
    courseId,
    titleUz,
    scheduledAt: at(days),
    status: "scheduled" as const,
  });
  await prisma.lesson.createMany({
    data: [
      // 1 taught of 3 → 33% progress: eligible for the 50% special refund.
      ended(F.refund.lessonId, F.refund.courseId, F.refund.lessonTitle, -3),
      scheduled(id("13"), F.refund.courseId, "Flow refund upcoming lesson 1", 7),
      scheduled(id("14"), F.refund.courseId, "Flow refund upcoming lesson 2", 14),
      ended(F.keep.lessonId, F.keep.courseId, "Flow keep ended lesson", -2),
      scheduled(id("22"), F.cancel.courseId, "Flow cancel lesson 1", 7),
      scheduled(id("23"), F.cancel.courseId, "Flow cancel lesson 2", 8),
      ended(F.assignments.lessonId, F.assignments.courseId, "Flow assignments ended lesson", -2),
      ended(id("42"), F.completion.courseId, "Flow completion lesson 1", -6),
      ended(id("43"), F.completion.courseId, "Flow completion lesson 2", -3),
      ended(id("52"), F.certificate.courseId, "Flow certificate lesson 1", -20),
      ended(id("53"), F.certificate.courseId, "Flow certificate lesson 2", -15),
      ended(id("62"), F.otherTeacherCourse.courseId, "Flow other teacher lesson", -2),
    ],
  });

  const purchase = (purchaseId: string, userId: string, courseId: string, amountPaid: number) => ({
    id: purchaseId,
    userId,
    courseId,
    amountPaid,
    status: "completed" as const,
    legacyBackfill: false,
    completedAt: at(-10),
  });
  await prisma.purchase.createMany({
    data: [
      purchase(F.refund.purchaseId, F.users.refund1.id, F.refund.courseId, F.refund.amountPaid),
      purchase(F.cancel.purchaseId, F.users.cancel1.id, F.cancel.courseId, F.cancel.amountPaid),
    ],
  });
  // /admin/payments lists Payment rows; the refund cell needs one pointing at the purchase.
  await prisma.payment.createMany({
    data: [
      { id: id("73"), userId: F.users.refund1.id, courseId: F.refund.courseId, purchaseId: F.refund.purchaseId, tier: "t2", amount: F.refund.amountPaid, status: "demo_paid", provider: "demo", isDemo: true, paidAt: at(-10) },
      { id: id("74"), userId: F.users.cancel1.id, courseId: F.cancel.courseId, purchaseId: F.cancel.purchaseId, tier: "t2", amount: F.cancel.amountPaid, status: "demo_paid", provider: "demo", isDemo: true, paidAt: at(-10) },
    ],
  });

  const seat = (seatId: string, userId: string, courseId: string, purchaseId: string | null = null) => ({
    id: seatId,
    userId,
    courseId,
    purchaseId,
    status: "active" as const,
    accessOpen: true,
    activatedAt: at(-10),
  });
  await prisma.enrollment.createMany({
    data: [
      seat(id("81"), F.users.refund1.id, F.refund.courseId, F.refund.purchaseId),
      // Keep seats leave the student cabinet open after the flow closes the other seat.
      seat(id("82"), F.users.refund1.id, F.keep.courseId),
      seat(id("83"), F.users.cancel1.id, F.cancel.courseId, F.cancel.purchaseId),
      seat(id("84"), F.users.cancel1.id, F.keep.courseId),
      seat(id("85"), F.users.assign1.id, F.assignments.courseId),
      seat(id("86"), F.users.assign2.id, F.assignments.courseId),
      seat(id("87"), F.users.cert1.id, F.completion.courseId),
      { ...seat(id("88"), F.users.cert1.id, F.certificate.courseId), status: "completed" as const, completedAt: at(-12) },
    ],
  });
}
