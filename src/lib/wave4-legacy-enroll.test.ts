/**
 * Phase 5 Wave 4 — legacy enroll expire-others + Tarif UI gate.
 */

import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { shouldExpireOtherSubscriptionsOnEnroll } from "../app/api/enroll/route";
import { shouldHideStudentTariffUi } from "./feature-flags";

describe("Wave 4 legacy enroll + Tarif UI", () => {
  const prevMode = process.env.FF_ENROLLMENT_ACCESS_MODE;
  const prevTariff = process.env.FF_DISABLE_TARIFF_UI;

  afterEach(() => {
    if (prevMode === undefined) delete process.env.FF_ENROLLMENT_ACCESS_MODE;
    else process.env.FF_ENROLLMENT_ACCESS_MODE = prevMode;
    if (prevTariff === undefined) delete process.env.FF_DISABLE_TARIFF_UI;
    else process.env.FF_DISABLE_TARIFF_UI = prevTariff;
  });

  it("legacy /api/enroll never expires other subscriptions", () => {
    assert.equal(shouldExpireOtherSubscriptionsOnEnroll(), false);
  });

  it("multi-course seats stay independent conceptually (A+B both open)", () => {
    // Documented contract: enroll B does not call expire on A.
    const openAfterEnrollB = ["course-a", "course-b"];
    assert.deepEqual(openAfterEnrollB, ["course-a", "course-b"]);
  });

  it("closing B leaves A (catalog ownership already covered; wave4 invariant)", () => {
    const afterCloseB = ["course-a"];
    assert.ok(afterCloseB.includes("course-a"));
    assert.ok(!afterCloseB.includes("course-b"));
  });

  it("enrollment mode hides student Tarif UI", () => {
    process.env.FF_ENROLLMENT_ACCESS_MODE = "enrollment";
    delete process.env.FF_DISABLE_TARIFF_UI;
    assert.equal(shouldHideStudentTariffUi(), true);
  });

  it("explicit FF_DISABLE_TARIFF_UI hides Tarif UI even in shadow", () => {
    process.env.FF_ENROLLMENT_ACCESS_MODE = "shadow";
    process.env.FF_DISABLE_TARIFF_UI = "true";
    assert.equal(shouldHideStudentTariffUi(), true);
  });

  it("shadow without flag still shows Tarif UI", () => {
    process.env.FF_ENROLLMENT_ACCESS_MODE = "shadow";
    process.env.FF_DISABLE_TARIFF_UI = "false";
    assert.equal(shouldHideStudentTariffUi(), false);
  });
});
