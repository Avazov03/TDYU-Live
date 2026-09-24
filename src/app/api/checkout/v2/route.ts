import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { featureFlags } from "@/lib/feature-flags";
import { isStudentRole } from "@/lib/roles";
import { checkoutCourseV2 } from "@/lib/checkout-v2/service";
import { CheckoutV2Error, checkoutErrorBody } from "@/lib/checkout-v2/errors";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    courseId: z.string().trim().uuid(),
    provider: z.enum(["demo", "payme", "click"]).optional(),
  })
  .strict();

const FORBIDDEN_BODY_KEYS = new Set([
  "amount",
  "price",
  "listPrice",
  "currency",
  "userId",
  "tier",
  "teacherId",
  "purchaseId",
  "enrollmentId",
  "idempotencyKey",
]);

/**
 * POST /api/checkout/v2
 * Gated by FF_COURSE_CHECKOUT_V2 (default false → FEATURE_DISABLED).
 * Does not redirect to V1.
 */
export async function POST(req: Request) {
  if (!featureFlags.courseCheckoutV2) {
    return NextResponse.json(
      checkoutErrorBody(
        new CheckoutV2Error(
          "FEATURE_DISABLED",
          403,
          "Course checkout v2 is disabled",
        ),
      ),
      { status: 403 },
    );
  }

  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new CheckoutV2Error("UNAUTHENTICATED", 401, "Authentication required");
    }
    if (!isStudentRole(session.user.role)) {
      throw new CheckoutV2Error("FORBIDDEN_ROLE", 403, "Only students can purchase courses");
    }

    const idempotencyKey = req.headers.get("idempotency-key")?.trim() ?? "";
    if (!idempotencyKey) {
      throw new CheckoutV2Error(
        "IDEMPOTENCY_KEY_REQUIRED",
        422,
        "Idempotency-Key header is required",
      );
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      throw new CheckoutV2Error("INVALID_BODY", 422, "Invalid JSON body");
    }

    if (json && typeof json === "object") {
      for (const key of Object.keys(json as object)) {
        if (FORBIDDEN_BODY_KEYS.has(key)) {
          throw new CheckoutV2Error(
            "INVALID_BODY",
            422,
            "Invalid body — amount/tier/userId and similar fields are forbidden",
          );
        }
      }
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      throw new CheckoutV2Error(
        "INVALID_BODY",
        422,
        "Invalid body — courseId (uuid) required",
      );
    }

    const result = await checkoutCourseV2({
      userId: session.user.id,
      courseId: parsed.data.courseId,
      idempotencyKey,
      provider: parsed.data.provider ?? "demo",
    });

    console.info("checkout_v2_ok", {
      userId: session.user.id,
      courseId: result.purchase.courseId,
      purchaseId: result.purchase.id,
      paymentId: result.payment.id,
      enrollmentId: result.enrollment.id,
      idempotencyKey,
      amountPaid: result.purchase.amountPaid,
      isDemo: result.payment.isDemo,
      idempotentReplay: result.idempotentReplay,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof CheckoutV2Error) {
      return NextResponse.json(checkoutErrorBody(err), { status: err.httpStatus });
    }
    console.error("checkout_v2_route_failed", err);
    return NextResponse.json(
      checkoutErrorBody(
        new CheckoutV2Error("INTERNAL_ERROR", 500, "Checkout failed"),
      ),
      { status: 500 },
    );
  }
}
