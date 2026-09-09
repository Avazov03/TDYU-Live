import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAnyActiveSubscription } from "@/lib/access";
import { TARIFF_FEATURES, TARIFF_LABELS, formatSom } from "@/lib/tariffs";
import { CheckoutButton } from "@/components/course/CheckoutButton";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { BRAND } from "@/lib/brand";
import type { TariffTier } from "@/generated/prisma/client";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const session = await auth();
  const course = await prisma.course.findFirst({
    where: { isPublished: true },
    orderBy: { createdAt: "asc" },
  });
  const sub = session?.user?.id ? await getAnyActiveSubscription(session.user.id) : null;

  const prices: { tier: TariffTier; price: number }[] = course
    ? [
        { tier: "t1", price: course.priceT1 },
        { tier: "t2", price: course.priceT2 },
        { tier: "t3", price: course.priceT3 },
      ]
    : [];

  return (
    <div className="site">
      <SiteHeader />
      <section className="site-hero">
        <p className="small" style={{ letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.85 }}>
          {BRAND.name}
        </p>
        <h1>TDYU professorlaridan jonli huquqiy kurslar</h1>
        <p className="site-hero-lead">
          Avval tizimga kiring, tarifni tanlang, demo to&apos;lovdan so&apos;ng kabinet ochiladi.
          Istalgan vaqt bosh sahifaga qaytishingiz mumkin.
        </p>
        <div className="row gap-12" style={{ justifyContent: "center", flexWrap: "wrap" }}>
          {sub ? (
            <Link href="/app" className="btn btn-primary">
              Kabinetga o&apos;tish
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
            <p className="muted small">Uch yo&apos;ldan birini tanlab, demo to&apos;lov qiling.</p>
          </div>
          <div className="stat-card">
            <div className="site-step-n">3</div>
            <h3>Kabinet</h3>
            <p className="muted small">Darslar ochiladi. «Bosh sahifa» orqali saytga qaytasiz.</p>
          </div>
        </div>
      </section>

      <section id="haqida" className="site-section">
        <h2>Loyiha haqida</h2>
        <p className="muted" style={{ maxWidth: 720 }}>
          {BRAND.name} — Toshkent davlat yuridik universiteti uchun pulli jonli-dars platformasi.
          Talaba tarif bo&apos;yicha darslarni ko&apos;radi, o&apos;qituvchi efir va guruhni boshqaradi,
          admin kurs va o&apos;qituvchilarni tasdiqlaydi.
        </p>
        <div className="kpi-grid" style={{ marginTop: 24 }}>
          <div className="stat-card">
            <div className="small muted">Talaba</div>
            <div className="num" style={{ fontSize: 18 }}>Tarif + dars kabineti</div>
          </div>
          <div className="stat-card">
            <div className="small muted">O&apos;qituvchi</div>
            <div className="num" style={{ fontSize: 18 }}>Efir, guruh, baho</div>
          </div>
          <div className="stat-card">
            <div className="small muted">Admin</div>
            <div className="num" style={{ fontSize: 18 }}>Kurs va o&apos;qituvchi</div>
          </div>
        </div>
      </section>

      <section id="tariflar" className="site-section">
        <h2>Tariflar</h2>
        <p className="muted" style={{ marginBottom: 20 }}>
          Demo to&apos;lov 30 kun. To&apos;lovdan keyin kabinet ochiladi — xohlasangiz bosh sahifaga qaytasiz.
        </p>
        {sub ? (
          <div className="card" style={{ maxWidth: 420 }}>
            <span className="badge success">{TARIFF_LABELS[sub.tier]} faol</span>
            <p className="small muted" style={{ marginTop: 8 }}>{sub.course.titleUz}</p>
            <Link href="/app" className="btn btn-primary" style={{ marginTop: 12 }}>
              Kabinetga o&apos;tish
            </Link>
          </div>
        ) : !course ? (
          <div className="empty">Hozircha kurs yo&apos;q.</div>
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
                  courseId={course.id}
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
