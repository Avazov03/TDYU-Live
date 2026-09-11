import { auth } from "@/lib/auth";
import { getActiveEntitlement, getAnyActiveSubscription } from "@/lib/access";
import { PLATFORM_PRICES, TARIFF_FEATURES, TARIFF_LABELS, formatSom } from "@/lib/tariffs";
import { CheckoutButton } from "@/components/course/CheckoutButton";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { HeroSparkles } from "@/components/site/HeroSparkles";
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
      <section className="site-hero">
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

      <section id="tariflar" className="lx-section">
        <div className="lx-section-head">
          <p className="lx-kicker">Narx</p>
          <h2 className="lx-title">Tariflar</h2>
          <p className="lx-sub">Demo to&apos;lov 30 kun. Keyin yo&apos;nalish va o&apos;qituvchini tanlaysiz.</p>
        </div>

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
          <div className="lx-prices">
            {prices.map(({ tier, price }) => (
              <article key={tier} className={`lx-price${tier === "t2" ? " is-featured" : ""}`}>
                {tier === "t2" ? <p className="lx-price-tag">Tavsiya</p> : <p className="lx-price-tag muted">&nbsp;</p>}
                <h3 className="lx-price-name">{TARIFF_LABELS[tier]}</h3>
                <p className="lx-price-amount">{formatSom(price)}</p>
                <ul className="lx-price-list">
                  {TARIFF_FEATURES[tier].map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <CheckoutButton
                  tier={tier}
                  label={session?.user ? "Demo to'lash" : "Kirib to'lash"}
                />
              </article>
            ))}
          </div>
        )}
      </section>

      <SiteFooter />
    </div>
  );
}
