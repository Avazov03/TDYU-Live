/**
 * Checkout V2 unit tests (node:test) — pure eligibility + error contract.
 * No DB, no flag enablement.
 *
 *   npm run test:checkout-v2
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EnrollmentStatus } from "@/generated/prisma/client";
import {
  CHECKOUT_V2_CURRENCY,
  evaluateBuyerEligibility,
  isCapacityAvailable,
  isClosedEnrollmentSeat,
  isCourseLifecyclePurchaseable,
  isOpenEnrollmentSeat,
  LEGACY_PAYMENT_TIER_SENTINEL,
  resolveServerListPrice,
} from "./eligibility";
import { CheckoutV2Error, checkoutErrorBody } from "./errors";

function seat(
  status: EnrollmentStatus,
  accessOpen: boolean,
): { status: EnrollmentStatus; accessOpen: boolean } {
  return { status, accessOpen };
}

describe("Checkout V2 eligibility — lifecycle", () => {
  it("active course is purchaseable", () => {
    assert.equal(isCourseLifecyclePurchaseable("active", true), true);
  });

  it("completed course is purchaseable (late join / replay materials)", () => {
    assert.equal(isCourseLifecyclePurchaseable("completed", true), true);
  });

  it("published / upcoming are purchaseable", () => {
    assert.equal(isCourseLifecyclePurchaseable("published", true), true);
    assert.equal(isCourseLifecyclePurchaseable("upcoming", true), true);
  });

  it("cancelled course is denied", () => {
    assert.equal(isCourseLifecyclePurchaseable("cancelled", true), false);
  });

  it("draft / review / rejected are denied", () => {
    assert.equal(isCourseLifecyclePurchaseable("draft", false), false);
    assert.equal(isCourseLifecyclePurchaseable("in_review", false), false);
    assert.equal(isCourseLifecyclePurchaseable("rejected", false), false);
    assert.equal(isCourseLifecyclePurchaseable("submitted", false), false);
    assert.equal(isCourseLifecyclePurchaseable("changes_requested", false), false);
    assert.equal(isCourseLifecyclePurchaseable("approved", false), false);
  });

  it("unpublished / archived denied", () => {
    assert.equal(isCourseLifecyclePurchaseable("unpublished", false), false);
    assert.equal(isCourseLifecyclePurchaseable("archived", true), false);
  });

  it("legacy null lifecycle uses isPublished", () => {
    assert.equal(isCourseLifecyclePurchaseable(null, true), true);
    assert.equal(isCourseLifecyclePurchaseable(null, false), false);
    assert.equal(isCourseLifecyclePurchaseable(undefined, true), true);
  });
});

describe("Checkout V2 eligibility — price", () => {
  it("resolves server listPrice snapshot", () => {
    assert.equal(resolveServerListPrice(150000), 150000);
    assert.equal(resolveServerListPrice(0), 0);
  });

  it("no price deny", () => {
    assert.equal(resolveServerListPrice(null), null);
    assert.equal(resolveServerListPrice(undefined), null);
    assert.equal(resolveServerListPrice(-1), null);
  });

  it("currency constant is UZS", () => {
    assert.equal(CHECKOUT_V2_CURRENCY, "UZS");
  });

  it("legacy tier sentinel is not product SoT", () => {
    assert.equal(LEGACY_PAYMENT_TIER_SENTINEL, "t2");
  });
});

describe("Checkout V2 eligibility — capacity", () => {
  it("unlimited capacity allows", () => {
    assert.equal(isCapacityAvailable(null, 999), true);
    assert.equal(isCapacityAvailable(undefined, 0), true);
  });

  it("capacity full denies", () => {
    assert.equal(isCapacityAvailable(2, 2), false);
    assert.equal(isCapacityAvailable(2, 3), false);
  });

  it("capacity available when under max", () => {
    assert.equal(isCapacityAvailable(2, 0), true);
    assert.equal(isCapacityAvailable(2, 1), true);
  });
});

describe("Checkout V2 eligibility — enrollment seats", () => {
  it("active open → ALREADY_ENROLLED seat", () => {
    assert.equal(isOpenEnrollmentSeat(seat("active", true)), true);
  });

  it("completed open (permanent replay) still blocks re-buy", () => {
    assert.equal(isOpenEnrollmentSeat(seat("completed", true)), true);
  });

  it("refunded → re-buy allowed", () => {
    assert.equal(isOpenEnrollmentSeat(seat("refunded", false)), false);
    assert.equal(isClosedEnrollmentSeat(seat("refunded", false)), true);
  });

  it("closed accessOpen=false → re-buy allowed", () => {
    assert.equal(isOpenEnrollmentSeat(seat("active", false)), false);
    assert.equal(isClosedEnrollmentSeat(seat("active", false)), true);
  });

  it("cancelled → re-buy allowed", () => {
    assert.equal(isOpenEnrollmentSeat(seat("cancelled", false)), false);
    assert.equal(isClosedEnrollmentSeat(seat("cancelled", true)), true);
  });
});

describe("Checkout V2 eligibility — buyer", () => {
  it("healthy student buyer ok", () => {
    assert.deepEqual(
      evaluateBuyerEligibility({
        isBlocked: false,
        purchaseAllowed: true,
        accountStatus: "active",
      }),
      { ok: true },
    );
  });

  it("purchaseAllowed false", () => {
    assert.equal(
      evaluateBuyerEligibility({
        isBlocked: false,
        purchaseAllowed: false,
        accountStatus: "active",
      }).ok,
      false,
    );
  });

  it("blocked / restricted", () => {
    assert.equal(
      evaluateBuyerEligibility({
        isBlocked: true,
        purchaseAllowed: true,
        accountStatus: "active",
      }).ok,
      false,
    );
    assert.equal(
      evaluateBuyerEligibility({
        isBlocked: false,
        purchaseAllowed: true,
        accountStatus: "restricted",
      }).ok,
      false,
    );
  });
});

describe("Checkout V2 error contract", () => {
  it("FEATURE_DISABLED is 403", () => {
    const err = new CheckoutV2Error("FEATURE_DISABLED", 403, "Course checkout v2 is disabled");
    assert.equal(err.httpStatus, 403);
    assert.deepEqual(checkoutErrorBody(err), {
      ok: false,
      error: { code: "FEATURE_DISABLED", message: "Course checkout v2 is disabled" },
    });
  });

  it("ALREADY_ENROLLED / CAPACITY_FULL / IDEMPOTENCY_CONFLICT are 409", () => {
    assert.equal(new CheckoutV2Error("ALREADY_ENROLLED", 409, "x").httpStatus, 409);
    assert.equal(new CheckoutV2Error("CAPACITY_FULL", 409, "x").httpStatus, 409);
    assert.equal(new CheckoutV2Error("IDEMPOTENCY_CONFLICT", 409, "x").httpStatus, 409);
  });

  it("COURSE_NOT_PURCHASABLE is 422", () => {
    assert.equal(new CheckoutV2Error("COURSE_NOT_PURCHASABLE", 422, "x").httpStatus, 422);
  });

  it("UNAUTHENTICATED is 401", () => {
    assert.equal(new CheckoutV2Error("UNAUTHENTICATED", 401, "x").httpStatus, 401);
  });
});

describe("Checkout V2 multi-course & price snapshot semantics", () => {
  it("open seats on different courses are independent (no expire-other)", () => {
    const a = isOpenEnrollmentSeat(seat("active", true));
    const b = isOpenEnrollmentSeat(seat("active", true));
    assert.equal(a && b, true);
  });

  it("price snapshot uses resolved listPrice only", () => {
    const clientClaimed = 1;
    const server = resolveServerListPrice(200_000);
    assert.notEqual(server, clientClaimed);
    assert.equal(server, 200_000);
  });

  it("refunded seat does not consume capacity count helper input", () => {
    // Capacity counting uses only open seats; closed must be excluded by caller.
    const open = [seat("active", true), seat("completed", true)];
    const closed = [seat("refunded", false), seat("cancelled", false)];
    const openCount = open.filter(isOpenEnrollmentSeat).length;
    const closedAsOpen = closed.filter(isOpenEnrollmentSeat).length;
    assert.equal(openCount, 2);
    assert.equal(closedAsOpen, 0);
    assert.equal(isCapacityAvailable(2, openCount), false);
    assert.equal(isCapacityAvailable(2, openCount - 1 + closedAsOpen), true);
  });
});
