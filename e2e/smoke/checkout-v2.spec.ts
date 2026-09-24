import { expect, type APIRequestContext } from "@playwright/test";
import { test } from "../fixtures";
import { loginAs } from "../auth/login";
import {
  isCheckoutV2E2EEnabled,
  isE2EDbReady,
  skipReasonDbNotReady,
  studentCreds,
  skipReasonMissingCreds,
} from "../helpers/env";
import { STAGING_FIXTURE } from "../helpers/test-data";

/**
 * Checkout V2 browser E2E — real UI against staging (or local with flag on).
 *
 * Gates:
 * - E2E_DB_READY=1
 * - E2E_CHECKOUT_V2_ENABLED=1 (does not flip the server flag itself)
 * - Staging/local must have FF_COURSE_CHECKOUT_V2=true
 * - Lesson access after Enrollment-only purchase needs dual (or enrollment-serving) mode
 *
 * Target course: Fixture Course B (not owned by fixture.active1).
 * Course A remains owned — multi-course must stay open.
 */
const COURSE_B = {
  id:
    process.env.E2E_CHECKOUT_V2_COURSE_ID?.trim() ||
    "a4444444-4444-4444-4444-444444444402",
  title: process.env.E2E_CHECKOUT_V2_COURSE_TITLE?.trim() || "Fixture Course B",
  listPrice: Number(process.env.E2E_CHECKOUT_V2_LIST_PRICE ?? "280000"),
  lessonId:
    process.env.E2E_CHECKOUT_V2_LESSON_ID?.trim() ||
    "a5555555-5555-5555-5555-5555555555c2",
  lessonTitle:
    process.env.E2E_CHECKOUT_V2_LESSON_TITLE?.trim() || "Staging C2 recording",
};

const COURSE_A = {
  id: STAGING_FIXTURE.courseId,
  title: STAGING_FIXTURE.courseTitle,
  enrollmentId: STAGING_FIXTURE.enrollmentId,
};

type CheckoutV2Ok = {
  ok: true;
  purchase: {
    id: string;
    courseId: string;
    amountPaid: number;
    currency: string;
    status: string;
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
    status: string;
    accessOpen: boolean;
  };
  idempotentReplay: boolean;
};

test.describe("Checkout V2", () => {
  test.beforeEach(() => {
    test.skip(!isE2EDbReady(), skipReasonDbNotReady());
    test.skip(
      !isCheckoutV2E2EEnabled(),
      "Skipped: E2E_CHECKOUT_V2_ENABLED is not set. Enable FF_COURSE_CHECKOUT_V2 on staging first, then set E2E_CHECKOUT_V2_ENABLED=1.",
    );
  });

  test("Student can complete Checkout V2 purchase", async ({ page, monitor }) => {
    const creds = studentCreds();
    test.skip(!creds, skipReasonMissingCreds("student"));

    // Capture the V2 checkout API response from the real UI submit.
    let checkoutBody: CheckoutV2Ok | null = null;
    let capturedIdempotencyKey: string | null = null;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/api/checkout/v2")) {
        capturedIdempotencyKey = req.headers()["idempotency-key"] ?? null;
      }
    });
    page.on("response", async (res) => {
      if (res.request().method() === "POST" && res.url().includes("/api/checkout/v2")) {
        try {
          checkoutBody = (await res.json()) as CheckoutV2Ok;
        } catch {
          /* ignore parse errors — assertions below will fail clearly */
        }
      }
    });

    monitor.noteAction("Login as student");
    await loginAs(page, creds!, { monitor });

    // --- Multi-course baseline: Course A must remain visible/owned ---
    monitor.noteAction("Confirm Course A still in My Courses before purchase");
    await page.goto("/my-courses");
    await expect(page.locator(".lx-kicker").filter({ hasText: "Kurslarim" })).toBeVisible();
    await expect(page.getByText(COURSE_A.title).first()).toBeVisible();

    // --- Course discovery → detail ---
    monitor.noteAction(`Open Course B detail ${COURSE_B.id}`);
    const detailRes = await page.goto(`/courses/${COURSE_B.id}`);
    expect(detailRes?.status(), "course detail status").toBeLessThan(500);
    await expect(page.getByRole("heading", { name: COURSE_B.title, level: 2 })).toBeVisible();
    await expect(page.getByTestId("course-checkout-v2")).toBeVisible();

    monitor.noteAction("Click Checkout V2 CTA");
    await page.getByTestId("checkout-v2-cta").click();
    await expect(page).toHaveURL(new RegExp(`/checkout/v2\\?courseId=${COURSE_B.id}`));
    await expect(page.getByTestId("checkout-v2")).toBeVisible();

    monitor.noteAction("Continue to payment method");
    await page.getByTestId("checkout-v2-continue").click();
    await expect(page.getByTestId("checkout-v2-method-demo")).toBeVisible();

    monitor.noteAction("Pay via Checkout V2 demo");
    await page.getByTestId("checkout-v2-pay").click();
    await expect(page.getByTestId("checkout-v2-success")).toBeVisible({ timeout: 30_000 });
    expect(checkoutBody, "checkout v2 JSON body").toBeTruthy();
    expect(checkoutBody!.ok).toBe(true);
    expect(checkoutBody!.purchase.courseId).toBe(COURSE_B.id);
    expect(checkoutBody!.purchase.status).toBe("completed");
    expect(checkoutBody!.purchase.amountPaid).toBe(COURSE_B.listPrice);
    expect(checkoutBody!.purchase.currency).toBe("UZS");
    expect(checkoutBody!.payment.isDemo).toBe(true);
    expect(checkoutBody!.payment.provider).toBe("demo");
    expect(checkoutBody!.payment.paidAt).toBeTruthy();
    expect(checkoutBody!.enrollment.courseId).toBe(COURSE_B.id);
    expect(checkoutBody!.enrollment.status).toBe("active");
    expect(checkoutBody!.enrollment.accessOpen).toBe(true);
    expect(checkoutBody!.idempotentReplay).toBe(false);
    expect(capturedIdempotencyKey, "Idempotency-Key header").toBeTruthy();

    const purchaseId = checkoutBody!.purchase.id;
    const paymentId = checkoutBody!.payment.id;
    const enrollmentId = checkoutBody!.enrollment.id;
    const idemKey = capturedIdempotencyKey!;

    monitor.noteAction("Go to My Courses after success");
    await page.getByTestId("checkout-v2-goto-my-courses").click();
    await expect(page).toHaveURL(/\/my-courses/);
    await expect(page.getByText(COURSE_B.title).first()).toBeVisible({ timeout: 15_000 });
    // Multi-course: Course A still listed
    await expect(page.getByText(COURSE_A.title).first()).toBeVisible();

    monitor.noteAction("Open purchased Course B");
    await page.locator(`a[href="/courses/${COURSE_B.id}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`/courses/${COURSE_B.id}`));
    await expect(page.getByTestId("course-owned")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Darslar" })).toBeVisible();

    monitor.noteAction(`Open lesson ${COURSE_B.lessonId}`);
    const lessonRes = await page.goto(`/learn/${COURSE_B.lessonId}`);
    expect(lessonRes?.status(), "lesson HTTP status").toBeLessThan(500);
    expect(lessonRes?.status(), "lesson must not be forbidden").not.toBe(403);
    await expect(
      page.getByRole("heading", { level: 2, name: COURSE_B.lessonTitle }),
    ).toBeVisible({ timeout: 15_000 });
    // Dual/enrollment access: must not show the legacy paywall upsell.
    await expect(page.getByRole("link", { name: /Tarifni oshirish/i })).toHaveCount(0);
    await expect(page.getByLabel("Kurs progressi")).toBeVisible();

    // --- Idempotency replay (same key) via authenticated API ---
    monitor.noteAction("Replay same Idempotency-Key");
    const replay = await postCheckoutV2(page.request, COURSE_B.id, idemKey);
    expect(replay.status).toBe(200);
    expect(replay.body.ok).toBe(true);
    expect(replay.body.idempotentReplay).toBe(true);
    expect(replay.body.purchase.id).toBe(purchaseId);
    expect(replay.body.payment.id).toBe(paymentId);
    expect(replay.body.enrollment.id).toBe(enrollmentId);

    // --- Already enrolled with a new key ---
    monitor.noteAction("New key → ALREADY_ENROLLED");
    const conflict = await postCheckoutV2(
      page.request,
      COURSE_B.id,
      `e2e-already-${Date.now()}`,
    );
    expect(conflict.status).toBe(409);
    expect(conflict.body.ok).toBe(false);
    expect(conflict.body.error?.code).toBe("ALREADY_ENROLLED");

    // Expose ids for external DB verifier (agent / script).
    monitor.noteAction(
      `DB_VERIFY purchase=${purchaseId} payment=${paymentId} enrollment=${enrollmentId} courseA=${COURSE_A.enrollmentId}`,
    );
  });
});

async function postCheckoutV2(
  request: APIRequestContext,
  courseId: string,
  idempotencyKey: string,
): Promise<{
  status: number;
  body: CheckoutV2Ok & {
    ok: boolean;
    error?: { code?: string; message?: string };
    idempotentReplay?: boolean;
  };
}> {
  const res = await request.post("/api/checkout/v2", {
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    data: { courseId, provider: "demo" },
  });
  const body = (await res.json()) as CheckoutV2Ok & {
    ok: boolean;
    error?: { code?: string; message?: string };
  };
  return { status: res.status(), body };
}
