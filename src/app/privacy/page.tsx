import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";

export const metadata = {
  title: "Maxfiylik siyosati · Lexify",
  description: "Lexify foydalanuvchi ma’lumotlari va maxfiylik qoidalari.",
};

export default function PrivacyPage() {
  return (
    <div className="site">
      <SiteHeader />
      <main className="site-section" style={{ maxWidth: 720, margin: "0 auto" }}>
        <p className="small muted" style={{ marginBottom: 6 }}>
          Huquqiy
        </p>
        <h1 style={{ marginTop: 0 }}>Maxfiylik siyosati</h1>
        <p className="muted" style={{ lineHeight: 1.6 }}>
          Lexify sizning ism, email va o‘qish faoliyatingizni (davomat, topshiriq, obuna) faqat platforma
          ishlashi uchun saqlaydi. Ma’lumot uchinchi tomonga sotilmaydi.
        </p>
        <ul style={{ lineHeight: 1.7, paddingLeft: 18 }}>
          <li>Kirish: email yoki Google orqali.</li>
          <li>To‘lov: keyinchalik ulanadigan gateway orqali; demo rejimda pul yechilmaydi.</li>
          <li>Video: dars yozuvlari faqat obuna qilingan o‘quvchilarga ochiq.</li>
          <li>O‘chirish: so‘rov bo‘yicha hisobni yopish mumkin — aloqa orqali murojaat qiling.</li>
        </ul>
        <p className="small muted">Yangilangan: {new Date().toLocaleDateString("uz-UZ")}</p>
        <p style={{ marginTop: 24 }}>
          <Link href="/terms" className="btn btn-sm">
            Foydalanish shartlari
          </Link>{" "}
          <Link href="/" className="btn btn-sm">
            Bosh sahifa
          </Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
