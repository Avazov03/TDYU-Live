import { auth } from "@/lib/auth";
import { getActiveEntitlement, getAnyActiveSubscription } from "@/lib/access";
import { PLATFORM_PRICES, TARIFF_FEATURES, TARIFF_LABELS, formatSom } from "@/lib/tariffs";
import { CheckoutButton } from "@/components/course/CheckoutButton";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { BRAND } from "@/lib/brand";
import type { TariffTier } from "@/generated/prisma/client";
import Link from "next/link";

export const dynamic = "force-dynamic";

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
        <p className="small" style={{ letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.85 }}>
          {BRAND.name}
        </p>
        <h1>TDYU professorlaridan jonli huquqiy kurslar</h1>
        <p className="site-hero-lead">
          Tarif tanlang, yo&apos;nalish va o&apos;qituvchini belgilang — shu o&apos;qituvchining darsiga yozilasiz.
        </p>
        <div className="row gap-12" style={{ justifyContent: "center", flexWrap: "wrap" }}>
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
      </section>

      <section id="qanday" className="site-section">
        <h2>Qanday ishlaydi</h2>
        <div className="site-steps">
          <div className="stat-card">
            <div className="site-step-n">1</div>
            <h3>Kirish</h3>
            <p className="muted small">Ro&apos;yxatdan o&apos;ting yoki hisobingizga kiring.</p>
          </div>
          <div className="stat-card">
            <div className="site-step-n">2</div>
            <h3>Tarif</h3>
            <p className="muted small">1 / 2 / 3-tarif — demo to&apos;lov 30 kun.</p>
          </div>
          <div className="stat-card">
            <div className="site-step-n">3</div>
            <h3>Yo&apos;nalish</h3>
            <p className="muted small">Fakultet va o&apos;qituvchini tanlang, kursiga yoziling.</p>
          </div>
          <div className="stat-card">
            <div className="site-step-n">4</div>
            <h3>Dars</h3>
            <p className="muted small">Reja, jonli efir va yozuv — tarifingizga qarab.</p>
          </div>
        </div>
      </section>

      <section id="haqida" className="site-section">
        <h2>Loyiha haqida</h2>
        <p className="muted" style={{ maxWidth: 720 }}>
          {BRAND.name} — Toshkent davlat yuridik universiteti uchun pulli jonli-dars platformasi.
          Talaba o&apos;z o&apos;qituvchisiga yoziladi, o&apos;qituvchi guruh va efirni ko&apos;radi,
          admin o&apos;qituvchilarni taklif qiladi.
        </p>
      </section>

      <section id="tariflar" className="site-section">
        <h2>Tariflar</h2>
        <p className="muted" style={{ marginBottom: 20 }}>
          Demo to&apos;lov 30 kun. Keyin yo&apos;nalish va o&apos;qituvchini tanlaysiz.
        </p>
        {sub ? (
          <div className="card" style={{ maxWidth: 420 }}>
            <span className="badge success">{TARIFF_LABELS[sub.tier]} faol</span>
            <p className="small muted" style={{ marginTop: 8 }}>
              {sub.course.teacher.fullName} · {sub.course.titleUz}
            </p>
            <Link href="/app" className="btn btn-primary" style={{ marginTop: 12 }}>
              Kabinetga o&apos;tish
            </Link>
          </div>
        ) : entitlement ? (
          <div className="card" style={{ maxWidth: 420 }}>
            <span className="badge accent">{TARIFF_LABELS[entitlement.tier]} to&apos;langan</span>
            <p className="small muted" style={{ marginTop: 8 }}>
              Endi o&apos;qituvchini tanlang — kursga shundan keyin yozilasiz.
            </p>
            <Link href="/onboard" className="btn btn-primary" style={{ marginTop: 12 }}>
              O&apos;qituvchi tanlash
            </Link>
          </div>
        ) : (
          <div className="tariff-grid">
            {prices.map(({ tier, price }) => (
              <div key={tier} className={`card tariff-card${tier === "t2" ? " featured" : ""}`}>
                {tier === "t2" ? <span className="badge accent">Tavsiya</span> : null}
                <h3>{TARIFF_LABELS[tier]}</h3>
                <div className="num" style={{ fontSize: 22, margin: "8px 0" }}>{formatSom(price)}</div>
                <ul className="muted small" style={{ margin: "0 0 14px 16px", listStyle: "disc" }}>
                  {TARIFF_FEATURES[tier].map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <CheckoutButton
                  tier={tier}
                  label={session?.user ? "Demo to'lash" : "Kirib to'lash"}
                />
              </div>
            ))}
          </div>
        )}
      </section>
      <SiteFooter />
    </div>
  );
}
