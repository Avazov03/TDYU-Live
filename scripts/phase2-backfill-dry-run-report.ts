/**
 * Phase 2 prep: enriched Subscription → Enrollment mapping DRY-RUN.
 *
 * SAFETY:
 * - Never writes (ignores --apply; use phase1-backfill-enrollments.ts --apply only with approval).
 * - Does NOT create Purchase / Payment / Enrollment.
 * - Does NOT invent production rows; reports whatever is in DATABASE_URL.
 *
 * Usage:
 *   npx tsx scripts/phase2-backfill-dry-run-report.ts
 */

import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { isSubscriptionActive } from "../src/lib/tariffs";

type MappingRow = {
  subscriptionId: string;
  userId: string | null;
  courseId: string | null;
  userExists: boolean;
  courseExists: boolean;
  ambiguousCourse: boolean;
  duplicateTargetEnrollment: boolean;
  legacyActive: boolean;
  proposedStatus: "active" | "completed" | "skip";
  proposedAccessOpen: boolean;
  proposedStartsAt: string | null;
  proposedEndsAt: string | null;
  paymentLinkable: boolean;
  purchaseReconstruction: "link_existing_payment" | "legacy_zero_purchase" | "skip";
  skipReason?: string;
};

async function main() {
  const now = new Date();

  const subs = await prisma.subscription.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      userId: true,
      courseId: true,
      tier: true,
      startsAt: true,
      endsAt: true,
      createdAt: true,
      user: { select: { id: true } },
      course: { select: { id: true } },
    },
  });

  const [userCount, courseCount, paymentCount, entitlementCount, enrollmentCount] =
    await Promise.all([
      prisma.user.count(),
      prisma.course.count(),
      prisma.payment.count(),
      prisma.entitlement.count(),
      prisma.enrollment.count(),
    ]);

  if (subs.length === 0 && userCount === 0) {
    console.log(
      JSON.stringify(
        {
          verdict: "BLOCKED",
          reason:
            "DATABASE empty — cannot claim production-like mapping validated. Load fixture via scripts/phase2-access-fixture.ts (local/demo only) or point DATABASE_URL at a non-production snapshot.",
          counts: {
            users: userCount,
            courses: courseCount,
            subscriptions: 0,
            payments: paymentCount,
            entitlements: entitlementCount,
            enrollments: enrollmentCount,
          },
        },
        null,
        2,
      ),
    );
    return;
  }

  const mapped = new Set(
    (
      await prisma.enrollment.findMany({
        where: { legacySubscriptionId: { not: null } },
        select: { legacySubscriptionId: true },
      })
    ).map((e) => e.legacySubscriptionId!),
  );

  const rows: MappingRow[] = [];
  let active = 0;
  let expired = 0;
  let withoutUser = 0;
  let withoutCourse = 0;
  let ambiguousCourse = 0;
  let duplicateTarget = 0;
  let wouldCreate = 0;
  let skippedMapped = 0;

  for (const sub of subs) {
    const userExists = Boolean(sub.user);
    const courseExists = Boolean(sub.course);
    if (!userExists) withoutUser += 1;
    if (!courseExists) withoutCourse += 1;

    // Unique (userId, courseId) on Subscription — ambiguous mapping only if FKs broken.
    const ambiguous = !userExists || !courseExists;
    if (ambiguous) ambiguousCourse += 1;

    const legacyActive = isSubscriptionActive(sub.endsAt, now);
    if (legacyActive) active += 1;
    else expired += 1;

    const existingEnrollment = await prisma.enrollment.findFirst({
      where: { userId: sub.userId, courseId: sub.courseId },
      select: { id: true, status: true, legacySubscriptionId: true },
    });
    const duplicate =
      Boolean(existingEnrollment) &&
      existingEnrollment!.legacySubscriptionId !== sub.id;
    if (duplicate) duplicateTarget += 1;

    const payment = await prisma.payment.findFirst({
      where: {
        userId: sub.userId,
        courseId: sub.courseId,
        status: { in: ["demo_paid", "paid"] },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, amount: true, purchaseId: true },
    });

    // Spec: owned course → permanent accessOpen (do not mirror endsAt denial).
    const proposedAccessOpen = true;
    const proposedStatus: MappingRow["proposedStatus"] =
      !userExists || !courseExists
        ? "skip"
        : mapped.has(sub.id)
          ? "skip"
          : duplicate && existingEnrollment?.status === "active"
            ? "skip"
            : "active";

    let purchaseReconstruction: MappingRow["purchaseReconstruction"] =
      "legacy_zero_purchase";
    if (proposedStatus === "skip") purchaseReconstruction = "skip";
    else if (payment) purchaseReconstruction = "link_existing_payment";

    let skipReason: string | undefined;
    if (!userExists) skipReason = "subscription_without_user";
    else if (!courseExists) skipReason = "subscription_without_course";
    else if (mapped.has(sub.id)) {
      skipReason = "already_mapped_legacySubscriptionId";
      skippedMapped += 1;
    } else if (duplicate && existingEnrollment?.status === "active") {
      skipReason = "duplicate_active_enrollment_same_user_course";
    }

    if (proposedStatus === "active") wouldCreate += 1;

    rows.push({
      subscriptionId: sub.id,
      userId: sub.userId,
      courseId: sub.courseId,
      userExists,
      courseExists,
      ambiguousCourse: ambiguous,
      duplicateTargetEnrollment: duplicate,
      legacyActive,
      proposedStatus,
      proposedAccessOpen,
      proposedStartsAt: sub.startsAt.toISOString(),
      // endsAt is legacy metadata only — NOT used for proposed accessOpen.
      proposedEndsAt: sub.endsAt.toISOString(),
      paymentLinkable: Boolean(payment),
      purchaseReconstruction,
      skipReason,
    });
  }

  const entitlementOrphans = await prisma.entitlement.count({
    where: { user: { subscriptions: { none: {} } } },
  });

  const entitlementsWithSub = entitlementCount - entitlementOrphans;

  const report = {
    mode: "DRY-RUN",
    writes: false,
    verdict:
      withoutUser === 0 && withoutCourse === 0 && ambiguousCourse === 0
        ? "PASS_DETERMINISTIC"
        : "FAIL_AMBIGUOUS",
    datasetNote:
      userCount > 0 && subs.length > 0
        ? "Non-empty local/demo dataset — not a claim of production snapshot authenticity."
        : "Sparse dataset",
    totals: {
      users: userCount,
      courses: courseCount,
      payments: paymentCount,
      entitlements: entitlementCount,
      entitlementsWithSubscription: entitlementsWithSub,
      entitlementOrphansNoAutoEnroll: entitlementOrphans,
      enrollmentsExisting: enrollmentCount,
      subscriptionsTotal: subs.length,
      subscriptionsActive: active,
      subscriptionsExpired: expired,
      subscriptionWithoutUser: withoutUser,
      subscriptionWithoutCourse: withoutCourse,
      subscriptionAmbiguousCourseMapping: ambiguousCourse,
      subscriptionDuplicateTargetEnrollment: duplicateTarget,
      alreadyMappedLegacySubscriptionId: skippedMapped,
      wouldCreateEnrollment: wouldCreate,
    },
    purchasePaymentPolicy: {
      createDuringDryRun: false,
      onApply:
        "Optional: link existing Payment if user+course paid row exists; else create Purchase with amount 0 + legacyBackfill=true. Enrollment.accessOpen=true always (permanent replay compatible). Never create Enrollment from Entitlement orphans.",
      safeReconstruction:
        "Payment/Purchase can be reconstructed as legacy_backfill markers; they are NOT authoritative commerce history. Prefer leave Purchase amount=0 when no Payment row.",
    },
    permanentReplayNote:
      "proposedAccessOpen=true even when legacy endsAt is past — NEW access must not deny via endsAt.",
    multiCourseNote:
      "Each Subscription maps to Enrollment scoped by (userId, courseId). No expire-other-courses in backfill.",
    rows,
  };

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
