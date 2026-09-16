import { AppShell } from "@/components/layout/AppShell";
import { EmptyGuide } from "@/components/cabinet/EmptyGuide";
import { getActiveSubscriptions, requireAppUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { formatSom } from "@/lib/tariffs";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  await requireAppUser(`/search${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  const query = q?.trim() ?? "";

  const courses =
    query.length >= 2
      ? await prisma.course.findMany({
          where: {
            isPublished: true,
            OR: [
              { titleUz: { contains: query, mode: "insensitive" } },
              { descriptionUz: { contains: query, mode: "insensitive" } },
              { teacher: { fullName: { contains: query, mode: "insensitive" } } },
              { subject: { nameUz: { contains: query, mode: "insensitive" } } },
              { faculty: { nameUz: { contains: query, mode: "insensitive" } } },
            ],
          },
          include: {
            teacher: { select: { fullName: true } },
            faculty: { select: { nameUz: true } },
            subject: { select: { nameUz: true } },
            _count: { select: { lessons: true } },
          },
          take: 24,
        })
      : [];

  return (
    <AppShell>
      <div className="lx-board">
        <p className="lx-kicker">Qidiruv</p>
        <h2>{query ? `"${query}" natijalari` : "Kurs yoki o‘qituvchi"}</h2>
        <p className="muted small lx-lead">
          Yuqoridagi qidiruvdan kurs, fan yoki o‘qituvchi nomini yozing.
        </p>

        {!query ? (
          <EmptyGuide
            title="Qidiruvni boshlang"
            text="Kamida 2 ta belgi yozing. Yoki o‘z kurslaringizga qayting."
            href="/my-courses"
            cta="Kurslarim"
          />
        ) : courses.length === 0 ? (
          <EmptyGuide
            title="Hech narsa topilmadi"
            text={`"${query}" bo‘yicha nashr qilingan kurs yo‘q.`}
            href="/my-courses"
            cta="Kurslarim"
          />
        ) : (
          <>
            <p className="muted small" style={{ marginTop: -8 }}>
              {courses.length} ta kurs
            </p>
            <div className="lx-stack">
              {courses.map((c) => (
                <Link key={c.id} href={`/courses/${c.id}`} className="lx-row">
                  <div>
                    <p className="lx-kicker">
                      {c.teacher.fullName} · {c.subject.nameUz}
                    </p>
                    <h3>{c.titleUz}</h3>
                    <p className="small muted" style={{ margin: 0 }}>
                      {c.faculty.nameUz} · {c._count.lessons} dars · {formatSom(c.priceT1)} dan
                    </p>
                  </div>
                  <span className="lx-go">Ochish</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
