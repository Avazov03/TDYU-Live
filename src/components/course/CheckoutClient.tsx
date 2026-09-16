"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, CreditCard, Loader2, ShieldCheck } from "lucide-react";
import type { TariffTier } from "@/generated/prisma/client";
import {
  TARIFF_BLURBS,
  TARIFF_FEATURES,
  TARIFF_LABELS,
  TARIFF_SHORT,
  formatSom,
} from "@/lib/tariffs";

type Method = "payme" | "click" | "card";
type Step = "review" | "method" | "processing" | "success";

type Receipt = {
  id: string;
  amount: number;
  tier: TariffTier;
  provider: string;
  endsAt: string;
};

const METHODS: {
  id: Method;
  title: string;
  hint: string;
}[] = [
  { id: "payme", title: "Payme", hint: "Uzbekiston bo‘ylab keng tarqalgan" },
  { id: "click", title: "Click", hint: "Mobil ilova orqali tez to‘lov" },
  { id: "card", title: "Demo karta", hint: "Sinov uchun — haqiqiy pul yechilmaydi" },
];

function providerLabel(p: string) {
  if (p === "payme") return "Payme";
  if (p === "click") return "Click";
  return "Demo karta";
}

export function CheckoutClient({
  tier,
  price,
  courseId,
}: {
  tier: TariffTier;
  price: number;
  courseId?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("review");
  const [method, setMethod] = useState<Method>("payme");
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [nextPath, setNextPath] = useState("/onboard");

  const endsHint = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toLocaleDateString("uz-UZ", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }, []);

  async function confirmPay() {
    setError("");
    setStep("processing");
    await new Promise((r) => setTimeout(r, 2200));

    const res = await fetch("/api/payments/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tier,
        ...(courseId ? { courseId } : {}),
        provider: method === "card" ? "demo" : method,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      next?: string;
      payment?: Receipt;
    };

    if (!res.ok) {
      setError(data.error || "To‘lov amalga oshmadi");
      if (res.status === 401) {
        const cb = `/checkout?tier=${tier}${courseId ? `&courseId=${courseId}` : ""}`;
        router.push(`/login?callbackUrl=${encodeURIComponent(cb)}`);
        return;
      }
      setStep("method");
      return;
    }

    setReceipt(
      data.payment ?? {
        id: "—",
        amount: price,
        tier,
        provider: method === "card" ? "demo" : method,
        endsAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      },
    );
    setNextPath(data.next === "app" ? "/app" : "/onboard");
    setStep("success");
    router.refresh();
  }

  return (
    <div className="lx-checkout">
      <div className="lx-checkout-shell">
        <div className="lx-checkout-main">
          <p className="lx-checkout-kicker">To‘lov</p>
          <h1 className="lx-checkout-title">
            {step === "success" ? "To‘lov qabul qilindi" : "Obunani rasmiylashtirish"}
          </h1>
          <p className="lx-checkout-lead">
            {step === "success"
              ? "Chekingiz tayyor. Keyingi qadamda o‘qishni boshlaysiz."
              : "Tarifni tekshiring, to‘lov usulini tanlang va tasdiqlang."}
          </p>

          <ol className="lx-checkout-steps" aria-label="To‘lov bosqichlari">
            {(
              [
                ["review", "Tarif"],
                ["method", "Usul"],
                ["processing", "Tekshiruv"],
                ["success", "Chek"],
              ] as const
            ).map(([key, label], i) => {
              const order = ["review", "method", "processing", "success"] as Step[];
              const activeIdx = order.indexOf(step);
              const done = i < activeIdx || step === "success";
              const current = order[i] === step;
              return (
                <li
                  key={key}
                  className={`lx-checkout-step${done ? " is-done" : ""}${current ? " is-current" : ""}`}
                >
                  <span className="lx-checkout-step-n">{i + 1}</span>
                  {label}
                </li>
              );
            })}
          </ol>

          {step === "review" && (
            <section className="lx-checkout-panel">
              <h2 className="lx-checkout-panel-title">{TARIFF_LABELS[tier]}</h2>
              <p className="lx-checkout-panel-text">{TARIFF_BLURBS[tier]}</p>
              <ul className="lx-checkout-features">
                {TARIFF_FEATURES[tier].map((f) => (
                  <li key={f}>
                    <CheckCircle2 aria-hidden />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="lx-checkout-primary"
                onClick={() => setStep("method")}
              >
                Davom etish
              </button>
              <Link href="/#tariflar" className="lx-checkout-back">
                Boshqa tarif
              </Link>
            </section>
          )}

          {step === "method" && (
            <section className="lx-checkout-panel">
              <h2 className="lx-checkout-panel-title">To‘lov usuli</h2>
              <p className="lx-checkout-panel-text">
                Hozircha demo rejim — haqiqiy pul yechilmaydi, lekin oqim realdek.
              </p>
              <div className="lx-checkout-methods" role="radiogroup" aria-label="To‘lov usuli">
                {METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={method === m.id}
                    className={`lx-checkout-method${method === m.id ? " is-active" : ""}`}
                    onClick={() => setMethod(m.id)}
                  >
                    <span className="lx-checkout-method-ico" aria-hidden>
                      {m.id === "card" ? <CreditCard size={18} /> : <ShieldCheck size={18} />}
                    </span>
                    <span>
                      <strong>{m.title}</strong>
                      <small>{m.hint}</small>
                    </span>
                  </button>
                ))}
              </div>
              {error ? <p className="lx-checkout-error">{error}</p> : null}
              <button type="button" className="lx-checkout-primary" onClick={() => void confirmPay()}>
                {formatSom(price)} to‘lash
              </button>
              <button type="button" className="lx-checkout-back" onClick={() => setStep("review")}>
                Orqaga
              </button>
            </section>
          )}

          {step === "processing" && (
            <section className="lx-checkout-panel lx-checkout-processing">
              <Loader2 className="lx-checkout-spin" aria-hidden />
              <h2 className="lx-checkout-panel-title">To‘lov tekshirilmoqda…</h2>
              <p className="lx-checkout-panel-text">
                {providerLabel(method === "card" ? "demo" : method)} orqali so‘rov yuborildi.
                Iltimos, kuting.
              </p>
            </section>
          )}

          {step === "success" && receipt && (
            <section className="lx-checkout-panel">
              <div className="lx-checkout-success-badge">
                <CheckCircle2 aria-hidden />
                Muvaffaqiyatli
              </div>
              <h2 className="lx-checkout-panel-title">To‘lov cheki</h2>
              <dl className="lx-checkout-receipt">
                <div>
                  <dt>Chek №</dt>
                  <dd>{receipt.id.slice(0, 8).toUpperCase()}</dd>
                </div>
                <div>
                  <dt>Tarif</dt>
                  <dd>{TARIFF_SHORT[receipt.tier]}</dd>
                </div>
                <div>
                  <dt>Summa</dt>
                  <dd>{formatSom(receipt.amount)}</dd>
                </div>
                <div>
                  <dt>Usul</dt>
                  <dd>{providerLabel(receipt.provider)}</dd>
                </div>
                <div>
                  <dt>Amal qiladi</dt>
                  <dd>
                    {new Date(receipt.endsAt).toLocaleDateString("uz-UZ", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                className="lx-checkout-primary"
                onClick={() => router.push(nextPath)}
              >
                {nextPath === "/app" ? "Kabinetga o‘tish" : "O‘qituvchi tanlash"}
              </button>
              <Link href="/" className="lx-checkout-back">
                Bosh sahifa
              </Link>
            </section>
          )}
        </div>

        <aside className="lx-checkout-summary">
          <h2>Buyurtma</h2>
          <div className="lx-checkout-summary-row">
            <span>{TARIFF_SHORT[tier]} · 30 kun</span>
            <strong>{formatSom(price)}</strong>
          </div>
          <div className="lx-checkout-summary-row is-muted">
            <span>Muddat oxiri</span>
            <span>{endsHint}</span>
          </div>
          <div className="lx-checkout-summary-total">
            <span>Jami</span>
            <strong>{formatSom(price)}</strong>
          </div>
          <p className="lx-checkout-note">
            Demo to‘lov: hisobingizga obuna yoziladi, bankdan pul yechilmaydi.
          </p>
        </aside>
      </div>
    </div>
  );
}
