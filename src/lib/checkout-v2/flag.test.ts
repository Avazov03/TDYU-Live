/**
 * Flag default + FEATURE_DISABLED contract (no HTTP server).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { featureFlags } from "@/lib/feature-flags";
import { CheckoutV2Error, checkoutErrorBody } from "./errors";

describe("Checkout V2 feature flag", () => {
  it("FF_COURSE_CHECKOUT_V2 defaults OFF", () => {
    // Env may be set in some shells; assert module default path when unset.
    const raw = process.env.FF_COURSE_CHECKOUT_V2;
    if (raw === undefined || raw === "") {
      assert.equal(featureFlags.courseCheckoutV2, false);
    }
  });

  it("flag OFF response shape matches contract", () => {
    const body = checkoutErrorBody(
      new CheckoutV2Error("FEATURE_DISABLED", 403, "Course checkout v2 is disabled"),
    );
    assert.equal(body.ok, false);
    assert.equal(body.error.code, "FEATURE_DISABLED");
  });
});
