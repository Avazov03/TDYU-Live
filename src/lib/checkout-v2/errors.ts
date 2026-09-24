/**
 * Checkout V2 — machine-readable errors (CHECKOUT-V2-CONTRACT.md).
 */

export type CheckoutV2ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN_ROLE"
  | "PURCHASE_NOT_ALLOWED"
  | "ACCOUNT_BLOCKED"
  | "ACCOUNT_RESTRICTED"
  | "FEATURE_DISABLED"
  | "COURSE_NOT_FOUND"
  | "IDEMPOTENCY_CONFLICT"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "ALREADY_ENROLLED"
  | "CAPACITY_FULL"
  | "COURSE_NOT_PURCHASABLE"
  | "PRICE_UNAVAILABLE"
  | "INVALID_BODY"
  | "PROVIDER_NOT_IMPLEMENTED"
  | "INTERNAL_ERROR";

export class CheckoutV2Error extends Error {
  readonly code: CheckoutV2ErrorCode;
  readonly httpStatus: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: CheckoutV2ErrorCode,
    httpStatus: number,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "CheckoutV2Error";
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

export function checkoutErrorBody(err: CheckoutV2Error) {
  return {
    ok: false as const,
    error: {
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    },
  };
}
