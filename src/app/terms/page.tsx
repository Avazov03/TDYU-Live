import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";

export const metadata = {
  title: "Foydalanish shartlari · Lexify",
  description: "Lexify platformasidan foydalanish qoidalari.",
};

export default function TermsPage() {
  return (
    <div className="site">
      <SiteHeader />
      <main className="site-section" style={{ maxWidth: 720, margin: "0 auto" }}>
        <p className="small muted" style={{ marginBottom: 6 }}>
          Huquqiy
        </p>
        <h1 style={{ marginTop: 0 }}>Foydalanish shartlari</h1>
        <p className="muted" style={{ lineHeight: 1.6 }}>
          Lexify — onlayn dars, yozuv va topshiriq platformasi. Ro‘yxatdan o‘tish orqali quyidagilarga
          rozilik bildirganingiz hisoblanadi.
        </p>
        <ul style={{ lineHeight: 1.7, paddingLeft: 18 }}>
          <li>Hisob faqat o‘zingiz uchun; loginni boshqalar bilan ulashmang.</li>
          <li>Dars materiallari va yozuvlarni ruxsatsiz tarqatish mumkin emas.</li>
          <li>Obuna muddati tugasa, tegishli kontent yopilishi mumkin.</li>
          <li>O‘qituvchi va admin platforma qoidalariga rioya qilishadi; buzilishda kirish cheklanishi mumkin.</li>
          <li>Demo to‘lov rejimida haqiqiy pul yechilmaydi — bu alohida belgilangan bo‘ladi.</li>
        </ul>
        <p className="small muted">Yangilangan: {new Date().toLocaleDateString("uz-UZ")}</p>
        <p style={{ marginTop: 24 }}>
          <Link href="/privacy" className="btn btn-sm">
            Maxfiylik
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
