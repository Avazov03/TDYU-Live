/**
 * Phase 1 helper: Subscription → Enrollment (+ Purchase) backfill.
 *
 * SAFETY:
 * - Default DRY RUN (no writes).
 * - Does NOT create Enrollment from Entitlement orphans.
 * - Skips rows already mapped via legacySubscriptionId.
 * - Uses partial unique (user, course) ACTIVE — skips if active enrollment exists.
 *
 * Usage:
 *   npx tsx scripts/phase1-backfill-enrollments.ts
 *   npx tsx scripts/phase1-backfill-enrollments.ts --apply
 *
 * Do not run --apply in production without backup + approval.
 */

import "dotenv/config";
import { randomUUID } from "crypto";
import { prisma } from "../src/lib/prisma";

const APPLY = process.argv.includes("--apply");

async function main() {
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
    },
  });

  const existing = await prisma.enrollment.findMany({
    where: { legacySubscriptionId: { not: null } },
    select: { legacySubscriptionId: true },
  });
  const mapped = new Set(existing.map((e) => e.legacySubscriptionId!));

  let wouldCreate = 0;
  let skippedMapped = 0;
  let skippedActiveExists = 0;
  let created = 0;

  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log(`Subscriptions scanned: ${subs.length}`);

  for (const sub of subs) {
    if (mapped.has(sub.id)) {
      skippedMapped += 1;
      continue;
    }

    const active = await prisma.enrollment.findFirst({
      where: { userId: sub.userId, courseId: sub.courseId, status: "active" },
      select: { id: true },
    });
    if (active) {
      skippedActiveExists += 1;
      continue;
    }

    wouldCreate += 1;

    // Prefer a payment for same user+course; else amount 0 legacy backfill purchase.
    const payment = await prisma.payment.findFirst({
      where: {
        userId: sub.userId,
        courseId: sub.courseId,
        status: { in: ["demo_paid", "paid"] },
      },
      orderBy: { createdAt: "desc" },
    });

    const amountPaid = payment?.amount ?? 0;
    const nowOpen = sub.endsAt.getTime() > Date.now();

    if (!APPLY) {
      console.log(
        `[dry] sub=${sub.id} user=${sub.userId} course=${sub.courseId} amount=${amountPaid} accessOpen=${nowOpen || true}`,
      );
      continue;
    }

    const purchaseId = randomUUID();
    const enrollmentId = randomUUID();

    await prisma.$transaction(async (tx) => {
      await tx.purchase.create({
        data: {
          id: purchaseId,
          userId: sub.userId,
          courseId: sub.courseId,
          amountPaid,
          status: "completed",
          legacyBackfill: true,
          legacyTier: sub.tier,
          completedAt: sub.startsAt,
          idempotencyKey: `legacy-sub:${sub.id}`,
        },
      });

      if (payment && !payment.purchaseId) {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            purchaseId,
            isDemo: payment.status === "demo_paid" || payment.provider === "demo",
            paidAt: payment.paidAt ?? payment.createdAt,
          },
        });
      }

      await tx.enrollment.create({
        data: {
          id: enrollmentId,
          userId: sub.userId,
          courseId: sub.courseId,
          purchaseId,
          status: "active",
          // Spec: permanent access for owned courses — do not close on legacy endsAt.
          accessOpen: true,
          activatedAt: sub.startsAt,
          legacySubscriptionId: sub.id,
        },
      });
    });

    created += 1;
  }

  const entitlementOrphans = await prisma.entitlement.count({
    where: {
      user: { subscriptions: { none: {} } },
    },
  });

  console.log("---");
  console.log(`wouldCreate/created: ${APPLY ? created : wouldCreate}`);
  console.log(`skipped already mapped: ${skippedMapped}`);
  console.log(`skipped active enrollment exists: ${skippedActiveExists}`);
  console.log(
    `Entitlement orphans (NO auto enrollment): ${entitlementOrphans}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
