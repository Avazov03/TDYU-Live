import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveEntitlement, getAnyActiveSubscription } from "@/lib/access";
import { isAdminRole, isStudentRole, isTeacherRole } from "@/lib/roles";
import { TARIFF_LABELS, isSubscriptionActive } from "@/lib/tariffs";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { TeacherPicker } from "@/components/student/TeacherPicker";

export const dynamic = "force-dynamic";

export default async function OnboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/onboard");
  if (isAdminRole(session.user.role)) redirect("/admin");
  if (isTeacherRole(session.user.role)) redirect("/teacher");
  if (!isStudentRole(session.user.role)) redirect("/");

  const sub = await getAnyActiveSubscription(session.user.id);
  if (sub) redirect("/app");
  const entitlement = await getActiveEntitlement(session.user.id);
  if (!entitlement) redirect("/#tariflar");

  const [faculties, teachers] = await Promise.all([
    prisma.faculty.findMany({ orderBy: { order: "asc" } }),
    prisma.teacher.findMany({
      where: { userId: { not: null } },
      include: {
        faculty: { select: { id: true, nameUz: true } },
        subject: { select: { nameUz: true } },
        courses: {
          select: {
            subscriptions: { select: { endsAt: true } },
          },
        },
      },
      orderBy: { fullName: "asc" },
    }),
  ]);

  const now = new Date();
  const cards = teachers.map((t) => ({
    id: t.id,
    fullName: t.fullName,
    facultyId: t.faculty.id,
    facultyName: t.faculty.nameUz,
    subjectName: t.subject.nameUz,
    studentCount: t.courses.reduce(
      (n, c) => n + c.subscriptions.filter((s) => isSubscriptionActive(s.endsAt, now)).length,
      0,
    ),
  }));

  return (
    <div className="site">
      <SiteHeader />
      <section className="site-section" style={{ maxWidth: 960, margin: "0 auto" }}>
        <p className="small muted" style={{ marginBottom: 6 }}>
          {TARIFF_LABELS[entitlement.tier]} faol — 30 kun
        </p>
        <h2>Yo&apos;nalish va o&apos;qituvchi</h2>
        <p className="muted" style={{ margin: "8px 0 20px", maxWidth: 640 }}>
          Fakultetni tanlang, keyin o&apos;qituvchini. Siz shu o&apos;qituvchining dars rejasiga va jonli efiriga yozilasiz.
        </p>
        {cards.length === 0 ? (
          <div className="empty">Hozircha kabineti ochilgan o&apos;qituvchi yo&apos;q. Admin taklif yuborsin.</div>
        ) : (
          <TeacherPicker
            faculties={faculties.map((f) => ({ id: f.id, nameUz: f.nameUz }))}
            teachers={cards}
          />
        )}
      </section>
      <SiteFooter />
    </div>
  );
}
