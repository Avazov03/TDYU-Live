import { test } from "node:test";
import assert from "node:assert/strict";
import { isDemoSuccessPayment, isRealRevenuePayment, splitRevenue } from "./revenue";

test("AT-PAY-08: demo payment is excluded from real revenue", () => {
  assert.equal(isRealRevenuePayment({ status: "demo_paid", isDemo: true }), false);
  assert.equal(isDemoSuccessPayment({ status: "demo_paid", isDemo: true }), true);
});

test("real revenue requires provider-settled paid and isDemo=false", () => {
  assert.equal(isRealRevenuePayment({ status: "paid", isDemo: false }), true);
  assert.equal(isRealRevenuePayment({ status: "paid", isDemo: true }), false, "paid but flagged demo");
  assert.equal(isDemoSuccessPayment({ status: "paid", isDemo: true }), true);
});

test("failed / pending / refunded rows count as neither", () => {
  for (const status of ["failed", "pending", "refunded", "cancelled"]) {
    assert.equal(isRealRevenuePayment({ status, isDemo: false }), false, status);
    assert.equal(isDemoSuccessPayment({ status, isDemo: true }), false, status);
  }
});

test("splitRevenue sums real and demo separately", () => {
  assert.deepEqual(
    splitRevenue([
      { amount: 100, status: "paid", isDemo: false },
      { amount: 40, status: "demo_paid", isDemo: true },
      { amount: 7, status: "failed", isDemo: false },
      { amount: 5, status: "paid", isDemo: true },
    ]),
    { real: 100, demo: 45 },
  );
});
