/**
 * Checkout V2 — pure eligibility helpers (no DB I/O).
 * Product: published/upcoming/active/completed are purchaseable; cancelled is not.
 */

import type {
  AccountStatus,
  CourseLifecycleStatus,
  EnrollmentStatus,
} from "@/generated/prisma/client";

/** Seats that hold capacity and block re-purchase. */
export function isOpenEnrollmentSeat(enrollment: {
  status: EnrollmentStatus;
  accessOpen: boolean;
}): boolean {
  if (!enrollment.accessOpen) return false;
  return enrollment.status === "active" || enrollment.status === "completed";
}

/** Closed seats allow re-buy and do not consume capacity. */
export function isClosedEnrollmentSeat(enrollment: {
  status: EnrollmentStatus;
  accessOpen: boolean;
}): boolean {
  if (!enrollment.accessOpen) return true;
  return enrollment.status === "refunded" || enrollment.status === "cancelled";
}

/**
 * Lifecycle / publish gate for NEW purchase.
 * COMPLETED and ACTIVE are purchaseable (mid-course + late join).
 * CANCELLED / draft / review / rejected / unpublished — deny.
 */
export function isCourseLifecyclePurchaseable(
  lifecycleStatus: CourseLifecycleStatus | null | undefined,
  isPublished: boolean,
): boolean {
  if (lifecycleStatus == null) {
    return isPublished === true;
  }

  switch (lifecycleStatus) {
    case "published":
    case "upcoming":
    case "active":
    case "completed":
      return true;
    case "draft":
    case "submitted":
    case "in_review":
    case "changes_requested":
    case "rejected":
    case "approved":
    case "archived":
    case "cancelled":
    case "unpublished":
      return false;
    default:
      return false;
  }
}

export function resolveServerListPrice(listPrice: number | null | undefined): number | null {
  if (listPrice == null || !Number.isFinite(listPrice) || listPrice < 0) {
    return null;
  }
  return Math.trunc(listPrice);
}

export function isCapacityAvailable(
  capacity: number | null | undefined,
  openSeatCount: number,
): boolean {
  if (capacity == null) return true; // unlimited
  return openSeatCount < capacity;
}

export type BuyerEligibilityInput = {
  isBlocked: boolean;
  purchaseAllowed: boolean;
  accountStatus: AccountStatus;
};

export type BuyerGate =
  | { ok: true }
  | { ok: false; code: "ACCOUNT_BLOCKED" | "PURCHASE_NOT_ALLOWED" | "ACCOUNT_RESTRICTED" };

export function evaluateBuyerEligibility(user: BuyerEligibilityInput): BuyerGate {
  if (user.isBlocked) return { ok: false, code: "ACCOUNT_BLOCKED" };
  if (!user.purchaseAllowed) return { ok: false, code: "PURCHASE_NOT_ALLOWED" };
  if (user.accountStatus === "restricted" || user.accountStatus === "suspended") {
    return { ok: false, code: "ACCOUNT_RESTRICTED" };
  }
  return { ok: true };
}

export const CHECKOUT_V2_CURRENCY = "UZS" as const;

/**
 * Legacy Payment.tier is NOT NULL on current schema.
 * V2 never branches on this value — sentinel only to satisfy DB until migration.
 * @see docs/architecture/CHECKOUT-V2-CONTRACT.md
 */
export const LEGACY_PAYMENT_TIER_SENTINEL = "t2" as const;
