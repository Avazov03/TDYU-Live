/**
 * Phase 5 Wave 3 — AppShell / home / navigation Enrollment-first (pure helpers).
 *
 *   npx tsx --test src/lib/student-shell.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveStudentHomePath,
  resolveStudentShellTariffTier,
  studentHasCabinetMembership,
} from "./access";

describe("Wave 3 student shell / home path", () => {
  it("1 Enrollment student → /app", () => {
    assert.equal(
      resolveStudentHomePath({
        mode: "enrollment",
        hasOpenEnrollment: true,
        hasActiveSubscription: false,
        hasActiveEntitlement: false,
      }),
      "/app",
    );
    assert.equal(
      studentHasCabinetMembership({
        mode: "enrollment",
        hasOpenEnrollment: true,
        hasActiveSubscription: false,
      }),
      true,
    );
  });

  it("2 Enrollment student keeps cabinet even with expired Subscription shape", () => {
    assert.equal(
      resolveStudentHomePath({
        mode: "enrollment",
        hasOpenEnrollment: true,
        hasActiveSubscription: false,
        hasActiveEntitlement: true,
      }),
      "/app",
    );
  });

  it("3 multiple Enrollments still mean cabinet membership (boolean any-open)", () => {
    assert.equal(
      studentHasCabinetMembership({
        mode: "enrollment",
        hasOpenEnrollment: true,
        hasActiveSubscription: false,
      }),
      true,
    );
  });

  it("4 no Enrollment → not cabinet; Entitlement → onboard; else /", () => {
    assert.equal(
      studentHasCabinetMembership({
        mode: "enrollment",
        hasOpenEnrollment: false,
        hasActiveSubscription: false,
      }),
      false,
    );
    assert.equal(
      resolveStudentHomePath({
        mode: "enrollment",
        hasOpenEnrollment: false,
        hasActiveSubscription: false,
        hasActiveEntitlement: true,
      }),
      "/onboard",
    );
    assert.equal(
      resolveStudentHomePath({
        mode: "enrollment",
        hasOpenEnrollment: false,
        hasActiveSubscription: false,
        hasActiveEntitlement: false,
      }),
      "/",
    );
  });

  it("5 Subscription-only does not gain target ownership in enrollment mode", () => {
    assert.equal(
      studentHasCabinetMembership({
        mode: "enrollment",
        hasOpenEnrollment: false,
        hasActiveSubscription: true,
      }),
      false,
    );
    assert.equal(
      resolveStudentHomePath({
        mode: "enrollment",
        hasOpenEnrollment: false,
        hasActiveSubscription: true,
        hasActiveEntitlement: false,
      }),
      "/",
    );
  });

  it("6 enrollment mode shell does not pass TariffTier (no Shorts lock by t1)", () => {
    assert.equal(
      resolveStudentShellTariffTier({
        mode: "enrollment",
        subscriptionTier: "t1",
      }),
      null,
    );
    assert.equal(
      resolveStudentShellTariffTier({
        mode: "shadow",
        subscriptionTier: "t1",
      }),
      "t1",
    );
  });

  it("legacy off|shadow still uses Subscription for home", () => {
    assert.equal(
      resolveStudentHomePath({
        mode: "shadow",
        hasOpenEnrollment: false,
        hasActiveSubscription: true,
        hasActiveEntitlement: false,
      }),
      "/app",
    );
  });

  it("dual accepts Enrollment or Subscription", () => {
    assert.equal(
      resolveStudentHomePath({
        mode: "dual",
        hasOpenEnrollment: true,
        hasActiveSubscription: false,
        hasActiveEntitlement: false,
      }),
      "/app",
    );
    assert.equal(
      resolveStudentHomePath({
        mode: "dual",
        hasOpenEnrollment: false,
        hasActiveSubscription: true,
        hasActiveEntitlement: false,
      }),
      "/app",
    );
  });
});
