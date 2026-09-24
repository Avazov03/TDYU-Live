import { test } from "../fixtures";
import { isCheckoutV2E2EEnabled } from "../helpers/env";

/**
 * Future Checkout V2 browser flow (not implemented yet).
 *
 * Gates (both required when implementing):
 * 1. Staging/local intentionally has FF_COURSE_CHECKOUT_V2=true
 * 2. E2E_CHECKOUT_V2_Enabled=true (or E2E_CHECKOUT_V2_ENABLED)
 *
 * This suite must NOT enable the feature flag and must NOT fake a green path
 * while Checkout V2 is off.
 */
test.describe("Checkout V2 (future)", () => {
  test("Student can complete Checkout V2 purchase", async () => {
    test.skip(
      !isCheckoutV2E2EEnabled(),
      "Skipped: E2E_CHECKOUT_V2_ENABLED is not set. Do not enable FF_COURSE_CHECKOUT_V2 from E2E.",
    );
    // Even when the env gate is on, the flow is not implemented yet.
    test.skip(true, "Checkout V2 browser E2E not implemented yet — add real clicks when staging V2 is ready.");
  });
});
