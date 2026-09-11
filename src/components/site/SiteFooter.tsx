import Link from "next/link";
import { BRAND } from "@/lib/brand";

function IconPin({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="10" r="2.2" fill="currentColor" />
    </svg>
  );
}

function IconMail({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m5 8 7 5 7-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconGlobe({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.8 12h16.4M12 3.8c2.4 2.6 3.6 5.4 3.6 8.2s-1.2 5.6-3.6 8.2c-2.4-2.6-3.6-5.4-3.6-8.2s1.2-5.6 3.6-8.2Z" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconTelegram({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.8 4.4 3.9 10.6c-1.1.4-1.1 1.1-.2 1.4l4.1 1.3 1.6 4.9c.2.6.1.8.7.8.5 0 .7-.2 1-0.5l2.3-2.2 4.4 3.3c.8.4 1.4.2 1.6-.8l2.9-13.6c.3-1.2-.4-1.7-1.5-1.3Zm-3 4.2-7.9 7.1-.3 3.3-1.5-4.7 9.7-5.7Z" />
    </svg>
  );
}

function IconInstagram({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.6" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
    </svg>
  );
}

function IconYoutube({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21.5 8.2a3 3 0 0 0-2.1-2.1C17.6 5.6 12 5.6 12 5.6s-5.6 0-7.4.5A3 3 0 0 0 2.5 8.2 31 31 0 0 0 2 12a31 31 0 0 0 .5 3.8 3 3 0 0 0 2.1 2.1c1.8.5 7.4.5 7.4.5s5.6 0 7.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 22 12a31 31 0 0 0-.5-3.8ZM10.2 14.8V9.2L14.8 12l-4.6 2.8Z" />
    </svg>
  );
}

function IconLinkedin({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6.3 9.2H3.6V20h2.7V9.2ZM5 7.7a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2ZM20.4 20h-2.7v-5.3c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9V20H11v-10.8h2.6v1.5h.1c.4-.7 1.3-1.8 3.1-1.8 3.3 0 3.9 2.2 3.9 5V20Z" />
    </svg>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="lx-footer">
      <div className="lx-footer-shell">
        <div className="lx-footer-cta">
          <p className="lx-footer-cta-lead">
            TDYU professorlaridan jonli huquqiy kurslar. Tarif tanlang — o&apos;qituvchingizga yoziling.
          </p>
          <div className="lx-footer-cta-card">
            <h2 className="lx-footer-cta-title">Kursni bugun boshlang</h2>
            <p className="lx-footer-cta-text">
              1 / 2 / 3-tarif — demo to&apos;lov 30 kun. Keyin yo&apos;nalish va o&apos;qituvchini tanlaysiz.
            </p>
            <Link href="/#tariflar" className="lx-footer-cta-btn">
              Tarif tanlash
            </Link>
          </div>
        </div>

        <div className="lx-footer-grid">
          <div className="lx-footer-col lx-footer-brand">
            <Link href="/" className="lx-footer-logo" aria-label={BRAND.name}>
              <span className="lx-footer-logo-mark">{BRAND.short}</span>
              <span className="lx-footer-logo-text">
                Lex<span>ify</span>
              </span>
            </Link>
            <p>
              {BRAND.name} — TDYU uchun jonli dars platformasi. Tarif → o&apos;qituvchi → dars.
            </p>
            <Link href="/#tariflar" className="lx-footer-pill">
              <IconTelegram className="lx-footer-pill-ico" />
              Tariflar
            </Link>
          </div>

          <nav className="lx-footer-col" aria-label="Tezkor havolalar">
            <h3 className="lx-footer-heading">Tezkor havolalar</h3>
            <ul className="lx-footer-links">
              <li>
                <Link href="/">Bosh sahifa</Link>
              </li>
              <li>
                <Link href="/#qanday">Qanday ishlaydi</Link>
              </li>
              <li>
                <Link href="/#haqida">Loyiha haqida</Link>
              </li>
              <li>
                <Link href="/#tariflar">Tariflar</Link>
              </li>
            </ul>
          </nav>

          <nav className="lx-footer-col" aria-label="Kabinet">
            <h3 className="lx-footer-heading">Kabinet</h3>
            <ul className="lx-footer-links">
              <li>
                <Link href="/app">Talaba kabineti</Link>
              </li>
              <li>
                <Link href="/login">Kirish</Link>
              </li>
              <li>
                <Link href="/register">Ro&apos;yxatdan o&apos;tish</Link>
              </li>
              <li>
                <Link href="/teacher">O&apos;qituvchi</Link>
              </li>
            </ul>
          </nav>

          <div className="lx-footer-col">
            <h3 className="lx-footer-heading">Aloqa</h3>
            <ul className="lx-footer-contact">
              <li>
                <span className="lx-footer-ico" aria-hidden>
                  <IconPin />
                </span>
                <span>Toshkent davlat yuridik universiteti</span>
              </li>
              <li>
                <span className="lx-footer-ico" aria-hidden>
                  <IconGlobe />
                </span>
                <a href="https://lexify.zonic.fit" target="_blank" rel="noreferrer">
                  lexify.zonic.fit
                </a>
              </li>
              <li>
                <span className="lx-footer-ico" aria-hidden>
                  <IconMail />
                </span>
                <a href="mailto:hello@lexify.zonic.fit">hello@lexify.zonic.fit</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="lx-footer-bottom">
          <p className="lx-footer-copy">
            © {year} {BRAND.name}. Barcha huquqlar himoyalangan.
          </p>
          <div className="lx-footer-social" aria-label="Ijtimoiy tarmoqlar">
            <a className="lx-footer-social-btn" href="/#tariflar" aria-label="Telegram / tariflar">
              <IconTelegram />
            </a>
            <a className="lx-footer-social-btn" href="/#haqida" aria-label="Loyiha haqida">
              <IconInstagram />
            </a>
            <a className="lx-footer-social-btn" href="/#qanday" aria-label="Qanday ishlaydi">
              <IconLinkedin />
            </a>
            <a className="lx-footer-social-btn" href="/" aria-label="Bosh sahifa">
              <IconYoutube />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
