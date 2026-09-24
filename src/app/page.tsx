import { auth } from "@/lib/auth";
import {
  getActiveEntitlement,
  getAnyActiveSubscription,
  getAnyOpenEnrollment,
  resolveStudentHomePath,
} from "@/lib/access";
import { getEnrollmentAccessMode, shouldHideStudentTariffUi } from "@/lib/feature-flags";
import { PLATFORM_PRICES, TARIFF_BLURBS, TARIFF_FEATURES, TARIFF_LABELS, TARIFF_SHORT, formatSom } from "@/lib/tariffs";
import { CheckoutButton } from "@/components/course/CheckoutButton";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { HeroSparkles } from "@/components/site/HeroSparkles";
import {
  PricingWithHeaderAndIcons,
  type PricingPlan,
} from "@/components/ui/pricing-with-header-and-icons";
import { BRAND } from "@/lib/brand";
import type { TariffTier } from "@/generated/prisma/client";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STEPS_LEGACY = [
  { n: "01", title: "Kirish", text: "Ro'yxatdan o'ting yoki hisobingizga kiring." },
  { n: "02", title: "Tarif", text: "1 / 2 / 3-tarif — demo to'lov 30 kun." },
  { n: "03", title: "Yo'nalish", text: "Fakultet va o'qituvchini tanlang, kursiga yoziling." },
  { n: "04", title: "Dars", text: "Reja, jonli efir va yozuv — tarifingizga qarab." },
] as const;

const STEPS_COURSE = [
  { n: "01", title: "Kirish", text: "Ro'yxatdan o'ting yoki hisobingizga kiring." },
  { n: "02", title: "Kurs", text: "Kerakli kursni tanlang va sotib oling." },
  { n: "03", title: "Enrollment", text: "Kursga yozilasiz — bir nechta kurs birga ishlaydi." },
  { n: "04", title: "Dars", text: "Reja, jonli efir va yozuv — Kurslarim orqali." },
] as const;

const ROLES = [
  { title: "Talaba", text: "O'z o'qituvchisiga yoziladi." },
  { title: "O'qituvchi", text: "Guruh va efirni ko'radi." },
  { title: "Admin", text: "O'qituvchilarni taklif qiladi." },
] as const;

export default async function LandingPage() {
  const session = await auth();
  const mode = getEnrollmentAccessMode();
  const userId = session?.user?.id;
  const enr =
    userId && (mode === "enrollment" || mode === "dual")
      ? await getAnyOpenEnrollment(userId)
      : null;
  const sub =
    userId && mode !== "enrollment" ? await getAnyActiveSubscription(userId) : null;
  const entitlement = userId ? await getActiveEntitlement(userId) : null;
  const home = userId
    ? resolveStudentHomePath({
        mode,
        hasOpenEnrollment: Boolean(enr),
        hasActiveSubscription: Boolean(sub),
        hasActiveEntitlement: Boolean(entitlement),
      })
    : null;
  const hideTariff = shouldHideStudentTariffUi();
  const STEPS = hideTariff ? STEPS_COURSE : STEPS_LEGACY;

  const prices: { tier: TariffTier; price: number }[] = [
    { tier: "t1", price: PLATFORM_PRICES.t1 },
    { tier: "t2", price: PLATFORM_PRICES.t2 },
    { tier: "t3", price: PLATFORM_PRICES.t3 },
  ];

  return (
    <div className="site">
      <SiteHeader />
      <section id="bosh" className="site-hero">
        <HeroSparkles />
        <div className="site-hero-content">
          <h1 className="site-hero-name">{BRAND.name}</h1>
          <p className="site-hero-tag">TDYU professorlaridan jonli huquqiy kurslar</p>
          <p className="site-hero-lead">
            {hideTariff
              ? "Kursni tanlang, sotib oling — Enrollment orqali darsga kirasiz. Bir nechta kurs birga ishlaydi."
              : "Tarif tanlang, yo'nalish va o'qituvchini belgilang — shu o'qituvchining darsiga yozilasiz."}
          </p>
          <div className="site-hero-cta">
            {home === "/app" ? (
              <Link href="/app" className="btn btn-primary">
                Kabinetga o&apos;tish
              </Link>
            ) : home === "/onboard" ? (
              <Link href="/onboard" className="btn btn-primary">
                O&apos;qituvchi tanlash
              </Link>
            ) : session?.user ? (
              <Link
                href={hideTariff ? "/search" : "/#tariflar"}
                className="btn btn-primary"
              >
                {hideTariff ? "Kurslarni ko‘rish" : "Tarif tanlash"}
              </Link>
            ) : (
              <>
                <Link href="/register" className="btn btn-primary">
                  Ro&apos;yxatdan o&apos;tish
                </Link>
                <Link href="/login" className="btn">
                  Kirish
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="lx-below">
        <div className="lx-below-bg" aria-hidden />
        <section id="qanday" className="lx-section">
          <div className="lx-section-head">
            <p className="lx-kicker">Jarayon</p>
            <h2 className="lx-title">Qanday ishlaydi</h2>
          </div>
          <ol className="lx-steps">
            {STEPS.map((step) => (
              <li key={step.n} className="lx-step">
                <span className="lx-step-n" aria-hidden>
                  {step.n}
                </span>
                <div className="lx-step-body">
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="haqida" className="lx-band">
          <div className="lx-band-inner">
            <p className="lx-kicker">Loyiha</p>
            <h2 className="lx-title lx-title-lg">Loyiha haqida</h2>
            <p className="lx-lead">
              {BRAND.name} — Toshkent davlat yuridik universiteti uchun pulli jonli-dars platformasi.
              Talaba o&apos;z o&apos;qituvchisiga yoziladi, o&apos;qituvchi guruh va efirni ko&apos;radi,
              admin o&apos;qituvchilarni taklif qiladi.
            </p>
            <div className="lx-roles">
              {ROLES.map((role) => (
                <div key={role.title} className="lx-role">
                  <h3>{role.title}</h3>
                  <p>{role.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="tariflar" className="lx-section lx-section-wide" data-testid="landing-pricing">
          {hideTariff ? (
            <div className="lx-status" data-testid="landing-course-cta">
              <p className="lx-status-label">Kurslar</p>
              <p className="lx-status-meta">
                Tarif paketlar o‘rniga alohida kurslar. Qidiruvdan kurs toping yoki Kabinetga o‘ting.
              </p>
              <div className="row gap-8" style={{ flexWrap: "wrap" }}>
                <Link href="/search" className="btn btn-primary">
                  Kurslarni qidirish
                </Link>
                {home === "/app" ? (
                  <Link href="/app" className="btn">
                    Kabinet
                  </Link>
                ) : null}
              </div>
            </div>
          ) : sub ? (
            <div className="lx-status">
              <p className="lx-status-label">{TARIFF_LABELS[sub.tier]} faol</p>
              <p className="lx-status-meta">
                {sub.course.teacher.fullName} · {sub.course.titleUz}
              </p>
              <Link href="/app" className="btn btn-primary">
                Kabinetga o&apos;tish
              </Link>
            </div>
          ) : entitlement ? (
            <div className="lx-status">
              <p className="lx-status-label">{TARIFF_LABELS[entitlement.tier]} to&apos;langan</p>
              <p className="lx-status-meta">
                Endi o&apos;qituvchini tanlang — kursga shundan keyin yozilasiz.
              </p>
              <Link href="/onboard" className="btn btn-primary">
                O&apos;qituvchi tanlash
              </Link>
            </div>
          ) : (
            <PricingWithHeaderAndIcons
              title="O'zingizga mos tarifni tanlang"
              subtitle="30 kunlik obuna. To‘lov sahifasida usulni tanlab, chek olasiz."
              plans={
                prices.map(({ tier, price }): PricingPlan => {
                  const featured = tier === "t2";
                  return {
                    name: TARIFF_SHORT[tier],
                    description: TARIFF_BLURBS[tier],
                    price: formatSom(price),
                    period: "/ 30 kun",
                    includesLabel: `${TARIFF_SHORT[tier]} tarif ichida`,
                    features: TARIFF_FEATURES[tier],
                    featured,
                    cta: (
                      <CheckoutButton
                        tier={tier}
                        label={
                          featured
                            ? session?.user
                              ? "Tanlash"
                              : "Kirib tanlash"
                            : session?.user
                              ? "Tanlash"
                              : "Kirib tanlash"
                        }
                        className={
                          featured
                            ? "inline-flex h-11 w-full items-center justify-center rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent-700)] disabled:opacity-60"
                            : "inline-flex h-11 w-full items-center justify-center rounded-lg border border-neutral-300 bg-transparent px-4 text-sm font-semibold text-neutral-900 shadow-sm transition hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-900"
                        }
                      />
                    ),
                  };
                }) as PricingPlan[]
              }
            />
          )}
        </section>

        <SiteFooter />
      </div>
    </div>
  );
}
