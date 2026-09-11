import { auth } from "@/lib/auth";
import { getActiveEntitlement, getAnyActiveSubscription } from "@/lib/access";
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

const STEPS = [
  { n: "01", title: "Kirish", text: "Ro'yxatdan o'ting yoki hisobingizga kiring." },
  { n: "02", title: "Tarif", text: "1 / 2 / 3-tarif — demo to'lov 30 kun." },
  { n: "03", title: "Yo'nalish", text: "Fakultet va o'qituvchini tanlang, kursiga yoziling." },
  { n: "04", title: "Dars", text: "Reja, jonli efir va yozuv — tarifingizga qarab." },
] as const;

const ROLES = [
  { title: "Talaba", text: "O'z o'qituvchisiga yoziladi." },
  { title: "O'qituvchi", text: "Guruh va efirni ko'radi." },
  { title: "Admin", text: "O'qituvchilarni taklif qiladi." },
] as const;

export default async function LandingPage() {
  const session = await auth();
  const sub = session?.user?.id ? await getAnyActiveSubscription(session.user.id) : null;
  const entitlement =
    !sub && session?.user?.id ? await getActiveEntitlement(session.user.id) : null;

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
            Tarif tanlang, yo&apos;nalish va o&apos;qituvchini belgilang — shu o&apos;qituvchining darsiga yozilasiz.
          </p>
          <div className="site-hero-cta">
            {sub ? (
              <Link href="/app" className="btn btn-primary">
                Kabinetga o&apos;tish
              </Link>
            ) : entitlement ? (
              <Link href="/onboard" className="btn btn-primary">
                O&apos;qituvchi tanlash
              </Link>
            ) : session?.user ? (
              <Link href="/#tariflar" className="btn btn-primary">
                Tarif tanlash
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

        <section id="tariflar" className="lx-section lx-section-wide">
          {sub ? (
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
              subtitle="Demo to'lov 30 kun. Keyin yo'nalish va o'qituvchini tanlaysiz."
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
                              ? "Boshlash"
                              : "Kirib boshlash"
                            : session?.user
                              ? "Demo to'lash"
                              : "Kirib to'lash"
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
