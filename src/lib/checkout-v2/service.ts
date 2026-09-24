/**
 * Checkout V2 service — Course → Purchase → Payment → Enrollment (atomic).
 * Flag-gated at the route. Does not touch Entitlement / Subscription / /api/enroll.
 *
 * Schema notes:
 * - Payment.currency persisted (Phase 2.3A); response uses payment.currency
 * - Payment.tier NOT NULL → LEGACY_PAYMENT_TIER_SENTINEL only (not V2 SoT)
 * - Open-enrollment uniqueness: TX + DB partial unique index
 */

import type {
  PaymentProvider,
  Prisma,
  PrismaClient,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  CHECKOUT_V2_CURRENCY,
  evaluateBuyerEligibility,
  isCourseLifecyclePurchaseable,
  isOpenEnrollmentSeat,
  LEGACY_PAYMENT_TIER_SENTINEL,
  resolveServerListPrice,
} from "./eligibility";
import { CheckoutV2Error } from "./errors";

export type CheckoutV2Input = {
  userId: string;
  courseId: string;
  idempotencyKey: string;
  provider?: PaymentProvider;
};

export type CheckoutV2Success = {
  ok: true;
  purchase: {
    id: string;
    courseId: string;
    amountPaid: number;
    currency: string;
    status: "completed";
    completedAt: string;
  };
  payment: {
    id: string;
    status: string;
    isDemo: boolean;
    amount: number;
    currency: string;
    paidAt: string;
    provider: string;
  };
  enrollment: {
    id: string;
    courseId: string;
    status: "active";
    accessOpen: true;
  };
  idempotentReplay: boolean;
};

type Tx = Prisma.TransactionClient;

function normalizeIdempotencyKey(raw: string): string {
  const key = raw.trim();
  if (!key || key.length > 64) {
    throw new CheckoutV2Error(
      "IDEMPOTENCY_KEY_REQUIRED",
      422,
      "Idempotency-Key header is required (max 64 chars)",
    );
  }
  return key;
}

async function lockCourseRow(tx: Tx, courseId: string) {
  await tx.$queryRaw`SELECT id FROM courses WHERE id = ${courseId} FOR UPDATE`;
}

async function findOpenEnrollment(tx: Tx, userId: string, courseId: string) {
  const rows = await tx.enrollment.findMany({
    where: { userId, courseId },
    select: { id: true, status: true, accessOpen: true },
  });
  return rows.find((e) => isOpenEnrollmentSeat(e)) ?? null;
}

async function countOpenSeats(tx: Tx, courseId: string): Promise<number> {
  const rows = await tx.enrollment.findMany({
    where: {
      courseId,
      accessOpen: true,
      status: { in: ["active", "completed"] },
    },
    select: { id: true },
  });
  return rows.length;
}

function toSuccess(args: {
  purchase: {
    id: string;
    courseId: string;
    amountPaid: number;
    currency: string;
    completedAt: Date | null;
  };
  payment: {
    id: string;
    status: string;
    isDemo: boolean;
    amount: number;
    currency: string;
    paidAt: Date | null;
    provider: string;
  };
  enrollment: { id: string; courseId: string };
  idempotentReplay: boolean;
}): CheckoutV2Success {
  const paidAt = args.payment.paidAt ?? args.purchase.completedAt ?? new Date();
  const completedAt = args.purchase.completedAt ?? paidAt;
  return {
    ok: true,
    purchase: {
      id: args.purchase.id,
      courseId: args.purchase.courseId,
      amountPaid: args.purchase.amountPaid,
      currency: args.purchase.currency,
      status: "completed",
      completedAt: completedAt.toISOString(),
    },
    payment: {
      id: args.payment.id,
      status: args.payment.status,
      isDemo: args.payment.isDemo,
      amount: args.payment.amount,
      currency: args.payment.currency || CHECKOUT_V2_CURRENCY,
      paidAt: paidAt.toISOString(),
      provider: args.payment.provider,
    },
    enrollment: {
      id: args.enrollment.id,
      courseId: args.enrollment.courseId,
      status: "active",
      accessOpen: true,
    },
    idempotentReplay: args.idempotentReplay,
  };
}

async function loadReplayPayload(
  tx: Tx,
  purchaseId: string,
): Promise<CheckoutV2Success | null> {
  const purchase = await tx.purchase.findUnique({
    where: { id: purchaseId },
    include: {
      payments: { orderBy: { createdAt: "asc" }, take: 1 },
      enrollments: {
        where: { accessOpen: true, status: { in: ["active", "completed"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!purchase || purchase.status !== "completed") return null;
  const payment = purchase.payments[0];
  const enrollment = purchase.enrollments[0];
  if (!payment || !enrollment) return null;
  return toSuccess({
    purchase: {
      id: purchase.id,
      courseId: purchase.courseId,
      amountPaid: purchase.amountPaid,
      currency: purchase.currency,
      completedAt: purchase.completedAt,
    },
    payment: {
      id: payment.id,
      status: payment.status,
      isDemo: payment.isDemo,
      amount: payment.amount,
      currency: payment.currency,
      paidAt: payment.paidAt,
      provider: payment.provider,
    },
    enrollment: { id: enrollment.id, courseId: enrollment.courseId },
    idempotentReplay: true,
  });
}

/**
 * Atomic checkout. Caller must enforce auth + feature flag.
 */
export async function checkoutCourseV2(
  input: CheckoutV2Input,
  client: PrismaClient = prisma,
): Promise<CheckoutV2Success> {
  const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
  const provider = input.provider ?? "demo";
  if (provider !== "demo") {
    throw new CheckoutV2Error(
      "PROVIDER_NOT_IMPLEMENTED",
      501,
      "Only demo provider is supported for checkout v2",
    );
  }

  try {
    return await client.$transaction(
      async (tx) => {
        // --- Idempotency early (Payment unique key) ---
        const existingPayment = await tx.payment.findUnique({
          where: { idempotencyKey },
        });
        if (existingPayment) {
          if (existingPayment.userId !== input.userId) {
            throw new CheckoutV2Error(
              "IDEMPOTENCY_CONFLICT",
              409,
              "Idempotency-Key already used",
            );
          }
          if (existingPayment.courseId && existingPayment.courseId !== input.courseId) {
            throw new CheckoutV2Error(
              "IDEMPOTENCY_CONFLICT",
              409,
              "Idempotency-Key reused with a different course",
              { courseId: existingPayment.courseId },
            );
          }
          if (existingPayment.purchaseId) {
            const replay = await loadReplayPayload(tx, existingPayment.purchaseId);
            if (replay) return replay;
          }
          throw new CheckoutV2Error(
            "IDEMPOTENCY_CONFLICT",
            409,
            "Idempotency-Key refers to an incomplete payment",
          );
        }

        const existingPurchase = await tx.purchase.findUnique({
          where: { idempotencyKey },
        });
        if (existingPurchase) {
          if (
            existingPurchase.userId !== input.userId ||
            existingPurchase.courseId !== input.courseId
          ) {
            throw new CheckoutV2Error(
              "IDEMPOTENCY_CONFLICT",
              409,
              "Idempotency-Key reused with different payload",
            );
          }
          const replay = await loadReplayPayload(tx, existingPurchase.id);
          if (replay) return replay;
        }

        const user = await tx.user.findUnique({
          where: { id: input.userId },
          select: {
            id: true,
            role: true,
            isBlocked: true,
            purchaseAllowed: true,
            accountStatus: true,
          },
        });
        if (!user) {
          throw new CheckoutV2Error("UNAUTHENTICATED", 401, "User not found");
        }
        const buyer = evaluateBuyerEligibility(user);
        if (!buyer.ok) {
          const messages = {
            ACCOUNT_BLOCKED: "Account is blocked",
            PURCHASE_NOT_ALLOWED: "Purchases are not allowed for this account",
            ACCOUNT_RESTRICTED: "Account is restricted",
          } as const;
          throw new CheckoutV2Error(buyer.code, 403, messages[buyer.code]);
        }

        await lockCourseRow(tx, input.courseId);

        const course = await tx.course.findUnique({
          where: { id: input.courseId },
          select: {
            id: true,
            listPrice: true,
            capacity: true,
            isPublished: true,
            lifecycleStatus: true,
          },
        });
        if (!course) {
          throw new CheckoutV2Error("COURSE_NOT_FOUND", 404, "Course not found");
        }

        if (!isCourseLifecyclePurchaseable(course.lifecycleStatus, course.isPublished)) {
          throw new CheckoutV2Error(
            "COURSE_NOT_PURCHASABLE",
            422,
            "Course is not available for purchase",
            { lifecycleStatus: course.lifecycleStatus, isPublished: course.isPublished },
          );
        }

        const amount = resolveServerListPrice(course.listPrice);
        if (amount == null) {
          throw new CheckoutV2Error(
            "PRICE_UNAVAILABLE",
            422,
            "Course listPrice is not set",
          );
        }

        const openEnrollment = await findOpenEnrollment(tx, input.userId, input.courseId);
        if (openEnrollment) {
          throw new CheckoutV2Error(
            "ALREADY_ENROLLED",
            409,
            "Active enrollment already exists for this course",
            { enrollmentId: openEnrollment.id },
          );
        }

        const openSeatCount = await countOpenSeats(tx, input.courseId);
        if (course.capacity != null && openSeatCount >= course.capacity) {
          throw new CheckoutV2Error("CAPACITY_FULL", 409, "Course capacity is full");
        }

        const now = new Date();

        const purchase = await tx.purchase.create({
          data: {
            userId: input.userId,
            courseId: input.courseId,
            amountPaid: amount,
            currency: CHECKOUT_V2_CURRENCY,
            status: "completed",
            idempotencyKey,
            completedAt: now,
          },
        });

        const payment = await tx.payment.create({
          data: {
            userId: input.userId,
            courseId: input.courseId,
            purchaseId: purchase.id,
            // LEGACY: schema requires TariffTier — not used by V2 pricing logic.
            tier: LEGACY_PAYMENT_TIER_SENTINEL,
            amount,
            currency: CHECKOUT_V2_CURRENCY,
            status: "demo_paid",
            provider: "demo",
            isDemo: true,
            idempotencyKey,
            paidAt: now,
          },
        });

        const enrollment = await tx.enrollment.create({
          data: {
            userId: input.userId,
            courseId: input.courseId,
            purchaseId: purchase.id,
            status: "active",
            accessOpen: true,
            activatedAt: now,
          },
        });

        return toSuccess({
          purchase: {
            id: purchase.id,
            courseId: purchase.courseId,
            amountPaid: purchase.amountPaid,
            currency: purchase.currency,
            completedAt: purchase.completedAt,
          },
          payment: {
            id: payment.id,
            status: payment.status,
            isDemo: payment.isDemo,
            amount: payment.amount,
            currency: payment.currency,
            paidAt: payment.paidAt,
            provider: payment.provider,
          },
          enrollment: { id: enrollment.id, courseId: enrollment.courseId },
          idempotentReplay: false,
        });
      },
      {
        // Serialize capacity + open-seat checks under course row lock.
        isolationLevel: "ReadCommitted",
        maxWait: 5_000,
        timeout: 15_000,
      },
    );
  } catch (err) {
    if (err instanceof CheckoutV2Error) throw err;

    // Unique constraint races (idempotency / partial uniqueness later)
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      throw new CheckoutV2Error(
        "IDEMPOTENCY_CONFLICT",
        409,
        "Idempotency conflict (unique constraint)",
      );
    }

    console.error("checkout_v2_failed", {
      userId: input.userId,
      courseId: input.courseId,
      idempotencyKey,
      err,
    });
    throw new CheckoutV2Error("INTERNAL_ERROR", 500, "Checkout failed");
  }
}
