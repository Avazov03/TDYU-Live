import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";

export default function LessonNotFound() {
  return (
    <AppShell active="my-courses">
      <div className="lx-mc-empty" data-testid="lesson-not-found">
        <h2>Dars topilmadi</h2>
        <p>
          Bu dars mavjud emas yoki sizga ochiq emas — u bekor qilingan yoki o‘qituvchi efirni boshlamasdan yopgan
          bo‘lishi mumkin. Keyingi darslar jadvalingizda.
        </p>
        <div className="row gap-8" style={{ justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/schedule" className="btn btn-primary">
            Jadvalim
          </Link>
          <Link href="/my-courses" className="btn">
            Kurslarim
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
