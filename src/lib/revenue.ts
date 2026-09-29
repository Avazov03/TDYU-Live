import type { PaymentStatus, Prisma } from "@/generated/prisma/client";

type Row = { amount: number; status: PaymentStatus | string; isDemo: boolean };

/** Real money only: settled by a provider and not a demo row. */
export function isRealRevenuePayment(p: Pick<Row, "status" | "isDemo">): boolean {
  return p.status === "paid" && !p.isDemo;
}

/** Successful demo checkout — shown separately, never counted as revenue. */
export function isDemoSuccessPayment(p: Pick<Row, "status" | "isDemo">): boolean {
  return p.status === "demo_paid" || (p.status === "paid" && p.isDemo);
}

export function splitRevenue(rows: Row[]): { real: number; demo: number } {
  let real = 0;
  let demo = 0;
  for (const p of rows) {
    if (isRealRevenuePayment(p)) real += p.amount;
    else if (isDemoSuccessPayment(p)) demo += p.amount;
  }
  return { real, demo };
}

export const REAL_PAYMENT_WHERE: Prisma.PaymentWhereInput = { status: "paid", isDemo: false };
export const SUCCESS_PAYMENT_WHERE: Prisma.PaymentWhereInput = { status: { in: ["demo_paid", "paid"] } };
/** Refunds that give back real money (the purchase was paid by a real provider). */
export const REAL_REFUND_WHERE: Prisma.RefundWhereInput = { purchase: { payments: { some: REAL_PAYMENT_WHERE } } };
