"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { CheckCircle2, CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { formatSom } from "@/lib/tariffs";

type Step = "review" | "method" | "processing" | "success";

type SuccessPayload = {
  purchase: { id: string; amountPaid: number; currency: string };
  payment: { id: string; provider: string; isDemo: boolean };
  enrollment: { id: string; courseId: string };
  idempotentReplay: boolean;
};

/**
 * Course-level Checkout V2 UI (demo provider only).
 * Calls POST /api/checkout/v2 with Idempotency-Key — no V1 tariff path.
 */
export function CheckoutV2Client({
  courseId,
  courseTitle,
  listPrice,
}: {
  courseId: string;
  courseTitle: string;
  listPrice: number;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("review");
  const [error, setError] = useState("");
  const [result, setResult] = useState<SuccessPayload | null>(null);
  const idempotencyKeyRef = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `v2-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );

  const priceLabel = useMemo(() => formatSom(listPrice), [listPrice]);

  async function confirmPay() {
    setError("");
    setStep("processing");

    const res = await fetch("/api/checkout/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKeyRef.current,
      },
      body: JSON.stringify({ courseId, provider: "demo" }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: { code?: string; message?: string };
      purchase?: SuccessPayload["purchase"];
      payment?: SuccessPayload["payment"];
      enrollment?: SuccessPayload["enrollment"];
      idempotentReplay?: boolean;
    };

    if (!res.ok || !data.ok || !data.purchase || !data.payment || !data.enrollment) {
      setError(data.error?.message || "To‘lov amalga oshmadi");
      if (res.status === 401) {
        const cb = `/checkout/v2?courseId=${encodeURIComponent(courseId)}`;
        router.push(`/login?callbackUrl=${encodeURIComponent(cb)}`);
        return;
      }
      setStep("method");
      return;
    }

    setResult({
      purchase: data.purchase,
      payment: data.payment,
      enrollment: data.enrollment,
      idempotentReplay: Boolean(data.idempotentReplay),
    });
    setStep("success");
    router.refresh();
  }

  return (
    <div className="lx-checkout" data-testid="checkout-v2">
      <div className="lx-checkout-shell">
        <div className="lx-checkout-main">
          <p className="lx-checkout-kicker">Checkout V2</p>
          <h1 className="lx-checkout-title">
            {step === "success" ? "Kurs sotib olindi" : "Kursni sotib olish"}
          </h1>
          <p className="lx-checkout-lead">
            {step === "success"
              ? "To‘lov qabul qilindi. Kurs Mening kurslarimda ochildi."
              : "Narx serverdan olinadi. Demo to‘lov — haqiqiy pul yechilmaydi."}
          </p>

          {step === "review" && (
            <section className="lx-checkout-panel">
              <h2 className="lx-checkout-panel-title">{courseTitle}</h2>
              <p className="lx-checkout-panel-text">
                Bir martalik kurs xarid. Obuna tariflari emas — Enrollment o‘rindiq.
              </p>
              <button
                type="button"
                className="lx-checkout-primary"
                data-testid="checkout-v2-continue"
                onClick={() => setStep("method")}
              >
                Davom etish · {priceLabel}
              </button>
              <Link
                href={`/courses/${courseId}`}
                className="lx-checkout-back"
                data-testid="checkout-v2-back-course"
              >
                Kursga qaytish
              </Link>
            </section>
          )}

          {step === "method" && (
            <section className="lx-checkout-panel">
              <h2 className="lx-checkout-panel-title">To‘lov usuli</h2>
              <p className="lx-checkout-panel-text">
                Faqat demo provayder. Haqiqiy Payme/Click hali yo‘q.
              </p>
              <div className="lx-checkout-methods" role="radiogroup" aria-label="To‘lov usuli">
                <button
                  type="button"
                  role="radio"
                  aria-checked
                  className="lx-checkout-method is-active"
                  data-testid="checkout-v2-method-demo"
                >
                  <span className="lx-checkout-method-ico" aria-hidden>
                    <CreditCard size={18} />
                  </span>
                  <span>
                    <strong>Demo to‘lov</strong>
                    <small>Sinov — pul yechilmaydi</small>
                  </span>
                </button>
              </div>
              {error ? (
                <p className="lx-checkout-error" role="alert" data-testid="checkout-v2-error">
                  {error}
                </p>
              ) : null}
              <button
                type="button"
                className="lx-checkout-primary"
                data-testid="checkout-v2-pay"
                onClick={() => void confirmPay()}
              >
                {priceLabel} to‘lash
              </button>
              <button
                type="button"
                className="lx-checkout-back"
                onClick={() => setStep("review")}
              >
                Orqaga
              </button>
            </section>
          )}

          {step === "processing" && (
            <section className="lx-checkout-panel lx-checkout-processing">
              <Loader2 className="lx-checkout-spin" aria-hidden />
              <h2 className="lx-checkout-panel-title">To‘lov tekshirilmoqda…</h2>
              <p className="lx-checkout-panel-text">
                <ShieldCheck size={16} aria-hidden /> Checkout V2 demo so‘rovi yuborildi.
              </p>
            </section>
          )}

          {step === "success" && result && (
            <section className="lx-checkout-panel" data-testid="checkout-v2-success">
              <div className="lx-checkout-success-badge">
                <CheckCircle2 aria-hidden />
                Muvaffaqiyatli
              </div>
              <h2 className="lx-checkout-panel-title">Xarid cheki</h2>
              <dl className="lx-checkout-receipt">
                <div>
                  <dt>Purchase</dt>
                  <dd data-testid="checkout-v2-purchase-id">
                    {result.purchase.id.slice(0, 8).toUpperCase()}
                  </dd>
                </div>
                <div>
                  <dt>Summa</dt>
                  <dd data-testid="checkout-v2-amount">
                    {formatSom(result.purchase.amountPaid)} ({result.purchase.currency})
                  </dd>
                </div>
                <div>
                  <dt>Payment</dt>
                  <dd>{result.payment.isDemo ? "Demo" : result.payment.provider}</dd>
                </div>
                <div>
                  <dt>Enrollment</dt>
                  <dd data-testid="checkout-v2-enrollment-id">
                    {result.enrollment.id.slice(0, 8).toUpperCase()}
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                className="lx-checkout-primary"
                data-testid="checkout-v2-goto-my-courses"
                onClick={() => router.push("/my-courses")}
              >
                Mening kurslarim
              </button>
              <Link href={`/courses/${courseId}`} className="lx-checkout-back">
                Kurs sahifasi
              </Link>
            </section>
          )}
        </div>

        <aside className="lx-checkout-summary">
          <h2>Buyurtma</h2>
          <div className="lx-checkout-summary-row">
            <span>{courseTitle}</span>
            <strong>{priceLabel}</strong>
          </div>
          <div className="lx-checkout-summary-total">
            <span>Jami</span>
            <strong>{priceLabel}</strong>
          </div>
          <p className="lx-checkout-note">
            Checkout V2: Purchase → Payment → Enrollment. Entitlement/Subscription yaratilmaydi.
          </p>
        </aside>
      </div>
    </div>
  );
}
