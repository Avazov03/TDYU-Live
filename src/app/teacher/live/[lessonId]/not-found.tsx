import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";

export default function TeacherLessonNotFound() {
  return (
    <AppShell active="teacher">
      <div className="lx-mc-empty" data-testid="lesson-not-found">
        <h2>Dars topilmadi</h2>
        <p>Bu dars o‘chirilgan — masalan, efir boshlanmasdan kutish xonasi yopilgan. Kurslaringiz Studio’da.</p>
        <Link href="/teacher" className="btn btn-primary">
          Studio’ga qaytish
        </Link>
      </div>
    </AppShell>
  );
}
